import { useCallback } from 'react';
import { getDb } from '../database/db';
import { stockageLabels } from '../constants/categories';
import type {
  CourantTransaction,
  StockageType,
  TransactionType,
  SoldeByStockage,
} from '../types';

/** Hook for courant (checking) account transactions and balances. */
export function useCourant(userId: number) {
  /** Get the balance for each wallet (espèce, mobile_money, banque) plus total. */
  const getSoldeByStockage = useCallback(
    async (): Promise<SoldeByStockage> => {
      const db = await getDb();
      const stockages: StockageType[] = ['espece', 'mobile_money', 'banque'];
      const result: SoldeByStockage = { espece: 0, mobile_money: 0, banque: 0, total: 0 };

      for (const s of stockages) {
        const entrees = await db.getFirstAsync<{ total: number }>(
          `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
           WHERE user_id = ? AND stockage = ? AND type = 'entree'`,
          userId,
          s
        );
        const sorties = await db.getFirstAsync<{ total: number }>(
          `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
           WHERE user_id = ? AND stockage = ? AND type = 'sortie'`,
          userId,
          s
        );
        const solde = (entrees?.total ?? 0) - (sorties?.total ?? 0);
        result[s] = solde;
      }

      result.total = result.espece + result.mobile_money + result.banque;
      return result;
    },
    [userId]
  );

  /** Get transactions for a specific wallet and month. */
  const getTransactions = useCallback(
    async (
      stockage: StockageType,
      month: number,
      year: number
    ): Promise<CourantTransaction[]> => {
      const db = await getDb();
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const rows = await db.getAllAsync<CourantTransaction>(
        `SELECT * FROM courant_transactions
         WHERE user_id = ? AND stockage = ? AND strftime('%Y-%m', date) = ?
         ORDER BY date DESC`,
        userId,
        stockage,
        monthStr
      );
      return rows;
    },
    [userId]
  );

  /** Insert a new courant transaction. */
  const addTransaction = useCallback(
    async (
      type: TransactionType,
      stockage: StockageType,
      montant: number,
      categorie: string,
      date: string,
      description?: string
    ): Promise<void> => {
      const db = await getDb();
      await db.runAsync(
        `INSERT INTO courant_transactions (user_id, type, stockage, montant, description, categorie, date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        userId,
        type,
        stockage,
        montant,
        description ?? null,
        categorie,
        date
      );
    },
    [userId]
  );

  /** Delete a courant transaction by id (scoped to user). */
  const deleteTransaction = useCallback(
    async (id: number): Promise<void> => {
      const db = await getDb();
      await db.runAsync(
        'DELETE FROM courant_transactions WHERE id = ? AND user_id = ?',
        id,
        userId
      );
    },
    [userId]
  );

  /** Get all transactions across all wallets for a given month. */
  const getAllTransactions = useCallback(
    async (month: number, year: number): Promise<CourantTransaction[]> => {
      const db = await getDb();
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const rows = await db.getAllAsync<CourantTransaction>(
        `SELECT * FROM courant_transactions
         WHERE user_id = ? AND strftime('%Y-%m', date) = ?
         ORDER BY date DESC`,
        userId,
        monthStr
      );
      return rows;
    },
    [userId]
  );

  /** Find the matching entree/sortie pair for a wallet transfer. */
  const getTransferPair = useCallback(
    async (id: number): Promise<{ id: number; cible: string } | null> => {
      const db = await getDb();
      const tx = await db.getFirstAsync<CourantTransaction>(
        'SELECT * FROM courant_transactions WHERE id = ? AND user_id = ?',
        id,
        userId
      );
      if (!tx?.description) return null;

      const versMatch = tx.description.match(/^Transfert vers (.+?)(?:\s+\+ frais de transaction)?$/);
      if (versMatch) {
        const cibleLabel = versMatch[1];
        const pair = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM courant_transactions
           WHERE user_id = ? AND type = 'entree' AND date = ? AND description = ?
           LIMIT 1`,
          userId,
          tx.date,
          `Transfert depuis ${stockageLabels[tx.stockage]}`
        );
        return pair ? { id: pair.id, cible: cibleLabel } : null;
      }

      const depuisMatch = tx.description.match(/^Transfert depuis (.+?)$/);
      if (depuisMatch) {
        const sourceLabel = depuisMatch[1];
        const pair = await db.getFirstAsync<{ id: number }>(
          `SELECT id FROM courant_transactions
           WHERE user_id = ? AND type = 'sortie' AND date = ? AND (description = ? OR description = ?)
           LIMIT 1`,
          userId,
          tx.date,
          `Transfert vers ${stockageLabels[tx.stockage]}`,
          `Transfert vers ${stockageLabels[tx.stockage]} + frais de transaction`
        );
        return pair ? { id: pair.id, cible: sourceLabel } : null;
      }

      return null;
    },
    [userId]
  );

  return {
    getSoldeByStockage,
    getTransactions,
    addTransaction,
    deleteTransaction,
    getAllTransactions,
    getTransferPair,
  };
}
