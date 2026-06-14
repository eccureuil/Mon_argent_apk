import { useCallback } from 'react';
import { api } from '../services/api';
import { getDb } from '../database/db';
import type {
  CourantTransaction,
  StockageType,
  TransactionType,
  SoldeByStockage,
} from '../types';

async function cacheSolde(userId: number, solde: SoldeByStockage): Promise<void> {
}

async function cacheTransactions(rows: CourantTransaction[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  for (const tx of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO courant_transactions (id, user_id, type, stockage, montant, description, categorie, date, source, facture_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      tx.id, tx.user_id, tx.type, tx.stockage, tx.montant,
      tx.description, tx.categorie, tx.date, tx.source, tx.facture_id
    );
  }
}

export function useCourant(userId: number) {
  const getSoldeByStockage = useCallback(async (): Promise<SoldeByStockage> => {
    const res = await api.get<SoldeByStockage>('/courant/solde');
    if (res.ok) return res.data;
    const db = await getDb();
    const stockages: StockageType[] = ['espece', 'mobile_money', 'banque'];
    const result: SoldeByStockage = { espece: 0, mobile_money: 0, banque: 0, total: 0 };
    for (const s of stockages) {
      const entrees = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
         WHERE user_id = ? AND stockage = ? AND type = 'entree'`, userId, s
      );
      const sorties = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
         WHERE user_id = ? AND stockage = ? AND type = 'sortie'`, userId, s
      );
      result[s] = (entrees?.total ?? 0) - (sorties?.total ?? 0);
    }
    result.total = result.espece + result.mobile_money + result.banque;
    return result;
  }, [userId]);

  const getTransactions = useCallback(async (
    stockage: StockageType, month: number, year: number
  ): Promise<CourantTransaction[]> => {
    const res = await api.get<CourantTransaction[]>(
      `/courant/transactions?stockage=${stockage}&month=${month}&year=${year}`
    );
    if (res.ok) {
      await cacheTransactions(res.data);
      return res.data;
    }
    const db = await getDb();
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    return db.getAllAsync<CourantTransaction>(
      `SELECT * FROM courant_transactions
       WHERE user_id = ? AND stockage = ? AND strftime('%Y-%m', date) = ?
       ORDER BY date DESC`,
      userId, stockage, monthStr
    );
  }, [userId]);

  const addTransaction = useCallback(async (
    type: TransactionType, stockage: StockageType, montant: number,
    categorie: string, date: string, description?: string
  ): Promise<void> => {
    const res = await api.post('/courant/transactions', {
      type, stockage, montant, categorie, date, description
    });
    if (!res.ok) throw new Error(res.data.error || 'Erreur ajout transaction');
    const tx = res.data as CourantTransaction;
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO courant_transactions (id, user_id, type, stockage, montant, description, categorie, date, source, facture_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      tx.id, userId, type, stockage, montant, description ?? null, categorie, date, 'manuel', null
    );
  }, [userId]);

  const deleteTransaction = useCallback(async (id: number): Promise<void> => {
    const res = await api.delete(`/courant/transactions/${id}`);
    if (!res.ok) throw new Error(res.data.error || 'Erreur suppression');
    const db = await getDb();
    await db.runAsync(
      'DELETE FROM courant_transactions WHERE id = ? AND user_id = ?', id, userId
    );
  }, [userId]);

  const getAllTransactions = useCallback(async (
    month: number, year: number
  ): Promise<CourantTransaction[]> => {
    const res = await api.get<CourantTransaction[]>(
      `/courant/transactions?month=${month}&year=${year}`
    );
    if (res.ok) {
      await cacheTransactions(res.data);
      return res.data;
    }
    const db = await getDb();
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    return db.getAllAsync<CourantTransaction>(
      `SELECT * FROM courant_transactions
       WHERE user_id = ? AND strftime('%Y-%m', date) = ?
       ORDER BY date DESC`,
      userId, monthStr
    );
  }, [userId]);

  const getTransferPair = useCallback(async (
    id: number
  ): Promise<{ id: number; cible: string } | null> => {
    const res = await api.get<{ id: number; cible: string } | null>(
      `/courant/transfers/${id}/pair`
    );
    if (res.ok) return res.data;
    const db = await getDb();
    const tx = await db.getFirstAsync<CourantTransaction>(
      'SELECT * FROM courant_transactions WHERE id = ? AND user_id = ?', id, userId
    );
    if (!tx?.description) return null;
    const stockageLabels: Record<string, string> = {
      espece: 'Espèces', mobile_money: 'Mobile Money', banque: 'Banque',
    };
    const versMatch = tx.description.match(/^Transfert vers (.+?)(?:\s+\+ frais de transaction)?$/);
    if (versMatch) {
      const pair = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM courant_transactions
         WHERE user_id = ? AND type = 'entree' AND date = ? AND description = ? LIMIT 1`,
        userId, tx.date, `Transfert depuis ${stockageLabels[tx.stockage]}`
      );
      return pair ? { id: pair.id, cible: versMatch[1] } : null;
    }
    const depuisMatch = tx.description.match(/^Transfert depuis (.+?)$/);
    if (depuisMatch) {
      const pair = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM courant_transactions
         WHERE user_id = ? AND type = 'sortie' AND date = ? AND (description = ? OR description = ?) LIMIT 1`,
        userId, tx.date,
        `Transfert vers ${stockageLabels[tx.stockage]}`,
        `Transfert vers ${stockageLabels[tx.stockage]} + frais de transaction`
      );
      return pair ? { id: pair.id, cible: depuisMatch[1] } : null;
    }
    return null;
  }, [userId]);

  return {
    getSoldeByStockage, getTransactions, addTransaction,
    deleteTransaction, getAllTransactions, getTransferPair,
  };
}
