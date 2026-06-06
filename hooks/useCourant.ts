import { useCallback } from 'react';
import { getDb } from '../database/db';
import type {
  CourantTransaction,
  StockageType,
  TransactionType,
  SoldeByStockage,
} from '../types';

export function useCourant(userId: number) {
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

  return {
    getSoldeByStockage,
    getTransactions,
    addTransaction,
    deleteTransaction,
    getAllTransactions,
  };
}
