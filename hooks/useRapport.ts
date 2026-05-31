import { useCallback } from 'react';
import { getDb } from '../database/db';
import { colors } from '../constants/colors';
import type {
  MonthlySummary,
  WeeklyBreakdown,
  CategorieBreakdown,
  EpargneEvolution,
} from '../types';

export function useRapport(userId: number) {
  const getMonthlySummary = useCallback(
    async (month: number, year: number): Promise<MonthlySummary> => {
      const db = await getDb();
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      const entrees = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
         WHERE user_id = ? AND type = 'entree' AND strftime('%Y-%m', date) = ?`,
        userId,
        monthStr
      );
      const sorties = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
         WHERE user_id = ? AND type = 'sortie' AND strftime('%Y-%m', date) = ?`,
        userId,
        monthStr
      );

      const total_entrees = entrees?.total ?? 0;
      const total_sorties = sorties?.total ?? 0;
      return {
        total_entrees,
        total_sorties,
        solde_net: total_entrees - total_sorties,
      };
    },
    [userId]
  );

  const getWeeklyBreakdown = useCallback(
    async (month: number, year: number): Promise<WeeklyBreakdown[]> => {
      const db = await getDb();
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      const rows = await db.getAllAsync<{ week: number; type: string; total: number }>(
        `SELECT CAST(strftime('%W', date) AS INTEGER) as week, type, COALESCE(SUM(montant), 0) as total
         FROM courant_transactions
         WHERE user_id = ? AND strftime('%Y-%m', date) = ?
         GROUP BY week, type
         ORDER BY week`,
        userId,
        monthStr
      );

      const weekMap = new Map<number, WeeklyBreakdown>();
      for (const row of rows) {
        if (!weekMap.has(row.week)) {
          weekMap.set(row.week, { week: row.week, entrees: 0, sorties: 0 });
        }
        const entry = weekMap.get(row.week)!;
        if (row.type === 'entree') entry.entrees = row.total;
        else entry.sorties = row.total;
      }

      return Array.from(weekMap.values()).sort((a, b) => a.week - b.week);
    },
    [userId]
  );

  const getCategorieBreakdown = useCallback(
    async (month: number, year: number): Promise<CategorieBreakdown[]> => {
      const db = await getDb();
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      const rows = await db.getAllAsync<{ categorie: string; total: number }>(
        `SELECT categorie, COALESCE(SUM(montant), 0) as total
         FROM courant_transactions
         WHERE user_id = ? AND type = 'sortie' AND strftime('%Y-%m', date) = ?
         GROUP BY categorie
         ORDER BY total DESC`,
        userId,
        monthStr
      );

      const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

      return rows.map((r) => ({
        categorie: r.categorie,
        montant: r.total,
        percentage: grandTotal > 0 ? (r.total / grandTotal) * 100 : 0,
        color:
          (colors.categories as Record<string, string>)[r.categorie] ??
          colors.textSec,
      }));
    },
    [userId]
  );

  const getEpargneEvolution = useCallback(
    async (month: number, year: number): Promise<EpargneEvolution[]> => {
      const db = await getDb();
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      const rows = await db.getAllAsync<{ date: string; type: string; montant: number }>(
        `SELECT date, type, montant FROM epargne_transactions
         WHERE user_id = ? AND strftime('%Y-%m', date) = ?
         ORDER BY date ASC`,
        userId,
        monthStr
      );

      const dailyMap = new Map<string, number>();
      let runningSolde = 0;

      for (const row of rows) {
        const day = row.date.substring(0, 10);
        if (row.type === 'entree') runningSolde += row.montant;
        else runningSolde -= row.montant;
        dailyMap.set(day, runningSolde);
      }

      return Array.from(dailyMap.entries()).map(([date, solde]) => ({
        date,
        solde,
      }));
    },
    [userId]
  );

  const getTopDepenses = useCallback(
    async (month: number, year: number, limit = 5) => {
      const db = await getDb();
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      return db.getAllAsync<{
        id: number;
        montant: number;
        description: string | null;
        categorie: string;
        date: string;
      }>(
        `SELECT id, montant, description, categorie, date FROM courant_transactions
         WHERE user_id = ? AND type = 'sortie' AND strftime('%Y-%m', date) = ?
         ORDER BY montant DESC LIMIT ?`,
        userId,
        monthStr,
        limit
      );
    },
    [userId]
  );

  const getEpargneSummary = useCallback(
    async (month: number, year: number): Promise<MonthlySummary> => {
      const db = await getDb();
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      const entrees = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(montant), 0) as total FROM epargne_transactions
         WHERE user_id = ? AND type = 'entree' AND strftime('%Y-%m', date) = ?`,
        userId,
        monthStr
      );
      const sorties = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(montant), 0) as total FROM epargne_transactions
         WHERE user_id = ? AND type = 'sortie' AND strftime('%Y-%m', date) = ?`,
        userId,
        monthStr
      );

      const total_entrees = entrees?.total ?? 0;
      const total_sorties = sorties?.total ?? 0;
      return {
        total_entrees,
        total_sorties,
        solde_net: total_entrees - total_sorties,
      };
    },
    [userId]
  );

  return {
    getMonthlySummary,
    getWeeklyBreakdown,
    getCategorieBreakdown,
    getEpargneEvolution,
    getTopDepenses,
    getEpargneSummary,
  };
}
