import { useState, useCallback } from 'react';
import { getDb } from '../database/db';
import type { EpargneTransaction, TransactionType } from '../types';

export function useEpargne(userId: number) {
  const [loading, setLoading] = useState(false);

  const getSolde = useCallback(async (): Promise<number> => {
    const db = await getDb();
    const entrees = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM epargne_transactions
       WHERE user_id = ? AND type = 'entree'`,
      userId
    );
    const sorties = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM epargne_transactions
       WHERE user_id = ? AND type = 'sortie'`,
      userId
    );
    return (entrees?.total ?? 0) - (sorties?.total ?? 0);
  }, [userId]);

  const getTransactions = useCallback(
    async (month: number, year: number): Promise<EpargneTransaction[]> => {
      const db = await getDb();
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const rows = await db.getAllAsync<EpargneTransaction>(
        `SELECT * FROM epargne_transactions
         WHERE user_id = ? AND strftime('%Y-%m', date) = ?
         ORDER BY date DESC`,
        userId,
        monthStr
      );
      return rows;
    },
    [userId]
  );

  const getAllTransactions = useCallback(async (): Promise<EpargneTransaction[]> => {
    const db = await getDb();
    const rows = await db.getAllAsync<EpargneTransaction>(
      `SELECT * FROM epargne_transactions
       WHERE user_id = ? ORDER BY date DESC`,
      userId
    );
    return rows;
  }, [userId]);

  const addTransaction = useCallback(
    async (
      type: TransactionType,
      montant: number,
      date: string,
      description?: string
    ): Promise<void> => {
      const db = await getDb();
      await db.runAsync(
        `INSERT INTO epargne_transactions (user_id, type, montant, description, date)
         VALUES (?, ?, ?, ?, ?)`,
        userId,
        type,
        montant,
        description ?? null,
        date
      );
    },
    [userId]
  );

  const deleteTransaction = useCallback(
    async (id: number): Promise<void> => {
      const db = await getDb();
      await db.runAsync(
        'DELETE FROM epargne_transactions WHERE id = ? AND user_id = ?',
        id,
        userId
      );
    },
    [userId]
  );

  return {
    loading,
    setLoading,
    getSolde,
    getTransactions,
    getAllTransactions,
    addTransaction,
    deleteTransaction,
  };
}
