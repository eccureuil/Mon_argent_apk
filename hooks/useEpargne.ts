import { useCallback } from 'react';
import { api } from '../services/api';
import { getDb } from '../database/db';
import type { EpargneTransaction, TransactionType } from '../types';

async function cacheTransactions(rows: EpargneTransaction[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  for (const tx of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO epargne_transactions (id, user_id, type, montant, description, date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      tx.id, tx.user_id, tx.type, tx.montant, tx.description, tx.date
    );
  }
}

export function useEpargne(userId: number) {
  const getSolde = useCallback(async (): Promise<number> => {
    const res = await api.get<{ solde: number }>('/epargne/solde');
    if (res.ok) return res.data.solde;
    const db = await getDb();
    const entrees = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM epargne_transactions
       WHERE user_id = ? AND type = 'entree'`, userId
    );
    const sorties = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM epargne_transactions
       WHERE user_id = ? AND type = 'sortie'`, userId
    );
    return (entrees?.total ?? 0) - (sorties?.total ?? 0);
  }, [userId]);

  const getTransactions = useCallback(async (
    month: number, year: number
  ): Promise<EpargneTransaction[]> => {
    const res = await api.get<EpargneTransaction[]>(
      `/epargne/transactions?month=${month}&year=${year}`
    );
    if (res.ok) {
      await cacheTransactions(res.data);
      return res.data;
    }
    const db = await getDb();
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    return db.getAllAsync<EpargneTransaction>(
      `SELECT * FROM epargne_transactions
       WHERE user_id = ? AND strftime('%Y-%m', date) = ? ORDER BY date DESC`,
      userId, monthStr
    );
  }, [userId]);

  const getAllTransactions = useCallback(async (): Promise<EpargneTransaction[]> => {
    const res = await api.get<EpargneTransaction[]>('/epargne/transactions?all=true');
    if (res.ok) {
      await cacheTransactions(res.data);
      return res.data;
    }
    const db = await getDb();
    return db.getAllAsync<EpargneTransaction>(
      'SELECT * FROM epargne_transactions WHERE user_id = ? ORDER BY date DESC', userId
    );
  }, [userId]);

  const addTransaction = useCallback(async (
    type: TransactionType, montant: number, date: string, description?: string
  ): Promise<void> => {
    const res = await api.post('/epargne/transactions', {
      type, montant, date, description
    });
    if (!res.ok) throw new Error(res.data.error || 'Erreur ajout');
    const tx = res.data as EpargneTransaction;
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO epargne_transactions (id, user_id, type, montant, description, date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      tx.id, userId, type, montant, description ?? null, date
    );
  }, [userId]);

  const deleteTransaction = useCallback(async (id: number): Promise<void> => {
    const res = await api.delete(`/epargne/transactions/${id}`);
    if (!res.ok) throw new Error(res.data.error || 'Erreur suppression');
    const db = await getDb();
    await db.runAsync(
      'DELETE FROM epargne_transactions WHERE id = ? AND user_id = ?', id, userId
    );
  }, [userId]);

  return { getSolde, getTransactions, getAllTransactions, addTransaction, deleteTransaction };
}
