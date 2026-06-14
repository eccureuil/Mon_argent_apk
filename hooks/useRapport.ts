import { useCallback } from 'react';
import { api } from '../services/api';
import { getDb } from '../database/db';
import { colors } from '../constants/colors';
import type {
  MonthlySummary, WeeklyBreakdown, CategorieBreakdown,
  EpargneEvolution,
} from '../types';

function monthStr(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function useRapport(userId: number) {
  const getMonthlySummary = useCallback(async (month: number, year: number): Promise<MonthlySummary> => {
    const res = await api.get<MonthlySummary>(
      `/rapport/monthly-summary?month=${month}&year=${year}`
    );
    if (res.ok) return res.data;
    const db = await getDb();
    const ms = monthStr(month, year);
    const entrees = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
       WHERE user_id = ? AND type = 'entree' AND strftime('%Y-%m', date) = ?`, userId, ms
    );
    const sorties = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
       WHERE user_id = ? AND type = 'sortie' AND strftime('%Y-%m', date) = ?`, userId, ms
    );
    const total_entrees = entrees?.total ?? 0;
    const total_sorties = sorties?.total ?? 0;
    return { total_entrees, total_sorties, solde_net: total_entrees - total_sorties };
  }, [userId]);

  const getWeeklyBreakdown = useCallback(async (month: number, year: number): Promise<WeeklyBreakdown[]> => {
    const res = await api.get<WeeklyBreakdown[]>(
      `/rapport/weekly-breakdown?month=${month}&year=${year}`
    );
    if (res.ok) return res.data;
    const db = await getDb();
    const ms = monthStr(month, year);
    const rows = await db.getAllAsync<{ week: number; type: string; total: number }>(
      `SELECT CAST(strftime('%W', date) AS INTEGER) as week, type, COALESCE(SUM(montant), 0) as total
       FROM courant_transactions WHERE user_id = ? AND strftime('%Y-%m', date) = ? GROUP BY week, type ORDER BY week`,
      userId, ms
    );
    const weekMap = new Map<number, WeeklyBreakdown>();
    for (const row of rows) {
      if (!weekMap.has(row.week)) weekMap.set(row.week, { week: row.week, entrees: 0, sorties: 0 });
      const entry = weekMap.get(row.week)!;
      if (row.type === 'entree') entry.entrees = row.total;
      else entry.sorties = row.total;
    }
    return Array.from(weekMap.values()).sort((a, b) => a.week - b.week);
  }, [userId]);

  const getCategorieBreakdown = useCallback(async (month: number, year: number): Promise<CategorieBreakdown[]> => {
    const res = await api.get<CategorieBreakdown[]>(
      `/rapport/categorie-breakdown?month=${month}&year=${year}`
    );
    if (res.ok) return res.data;
    const db = await getDb();
    const ms = monthStr(month, year);
    const rows = await db.getAllAsync<{ categorie: string; total: number }>(
      `SELECT categorie, COALESCE(SUM(montant), 0) as total FROM courant_transactions
       WHERE user_id = ? AND type = 'sortie' AND strftime('%Y-%m', date) = ? GROUP BY categorie ORDER BY total DESC`,
      userId, ms
    );
    const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
    const cats = await db.getAllAsync<{ value: string; color: string }>(
      'SELECT value, color FROM user_categories WHERE user_id = ?', userId
    );
    const catColorMap: Record<string, string> = {};
    for (const c of cats) catColorMap[c.value] = c.color;
    return rows.map((r) => ({
      categorie: r.categorie,
      montant: r.total,
      percentage: grandTotal > 0 ? (r.total / grandTotal) * 100 : 0,
      color: catColorMap[r.categorie] ?? colors.textSec,
    }));
  }, [userId]);

  const getEpargneEvolution = useCallback(async (month: number, year: number): Promise<EpargneEvolution[]> => {
    const res = await api.get<EpargneEvolution[]>(
      `/rapport/epargne-evolution?month=${month}&year=${year}`
    );
    if (res.ok) return res.data;
    const db = await getDb();
    const ms = monthStr(month, year);
    const rows = await db.getAllAsync<{ date: string; type: string; montant: number }>(
      `SELECT date, type, montant FROM epargne_transactions
       WHERE user_id = ? AND strftime('%Y-%m', date) = ? ORDER BY date ASC`,
      userId, ms
    );
    const dailyMap = new Map<string, number>();
    let runningSolde = 0;
    for (const row of rows) {
      const day = row.date.substring(0, 10);
      if (row.type === 'entree') runningSolde += row.montant;
      else runningSolde -= row.montant;
      dailyMap.set(day, runningSolde);
    }
    return Array.from(dailyMap.entries()).map(([date, solde]) => ({ date, solde }));
  }, [userId]);

  const getTopDepenses = useCallback(async (month: number, year: number, limit = 5) => {
    const res = await api.get<any[]>(
      `/rapport/top-depenses?month=${month}&year=${year}&limit=${limit}`
    );
    if (res.ok) return res.data;
    const db = await getDb();
    const ms = monthStr(month, year);
    return db.getAllAsync(
      `SELECT id, montant, description, categorie, date FROM courant_transactions
       WHERE user_id = ? AND type = 'sortie' AND strftime('%Y-%m', date) = ? ORDER BY montant DESC LIMIT ?`,
      userId, ms, limit
    );
  }, [userId]);

  const getEpargneSummary = useCallback(async (month: number, year: number): Promise<MonthlySummary> => {
    const res = await api.get<MonthlySummary>(
      `/rapport/epargne-summary?month=${month}&year=${year}`
    );
    if (res.ok) return res.data;
    const db = await getDb();
    const ms = monthStr(month, year);
    const entrees = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM epargne_transactions
       WHERE user_id = ? AND type = 'entree' AND strftime('%Y-%m', date) = ?`, userId, ms
    );
    const sorties = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(montant), 0) as total FROM epargne_transactions
       WHERE user_id = ? AND type = 'sortie' AND strftime('%Y-%m', date) = ?`, userId, ms
    );
    const total_entrees = entrees?.total ?? 0;
    const total_sorties = sorties?.total ?? 0;
    return { total_entrees, total_sorties, solde_net: total_entrees - total_sorties };
  }, [userId]);

  const getPreviousMonthSolde = useCallback(async (month: number, year: number): Promise<{ courant: number; epargne: number }> => {
    const res = await api.get<{ courant: number; epargne: number }>(
      `/rapport/previous-month-solde?month=${month}&year=${year}`
    );
    if (res.ok) return res.data;
    const db = await getDb();
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const courantRow = await db.getFirstAsync<{ solde: number }>(
      `SELECT COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE -montant END), 0) as solde
       FROM courant_transactions WHERE user_id = ? AND date < ?`, userId, firstDay
    );
    const epargneRow = await db.getFirstAsync<{ solde: number }>(
      `SELECT COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE -montant END), 0) as solde
       FROM epargne_transactions WHERE user_id = ? AND date < ?`, userId, firstDay
    );
    return { courant: courantRow?.solde ?? 0, epargne: epargneRow?.solde ?? 0 };
  }, [userId]);

  const getCategorieSummary = useCallback(async (month: number, year: number) => {
    const res = await api.get<any>(
      `/rapport/categorie-summary?month=${month}&year=${year}`
    );
    if (res.ok) return res.data;
    const db = await getDb();
    const ms = monthStr(month, year);
    const rows = await db.getAllAsync<{ type: string; categorie: string; total: number }>(
      `SELECT type, categorie, COALESCE(SUM(montant), 0) as total FROM courant_transactions
       WHERE user_id = ? AND strftime('%Y-%m', date) = ? GROUP BY type, categorie ORDER BY type, total DESC`,
      userId, ms
    );
    const cats = await db.getAllAsync<{ value: string; color: string }>(
      'SELECT value, color FROM user_categories WHERE user_id = ?', userId
    );
    const catColorMap: Record<string, string> = {};
    for (const c of cats) catColorMap[c.value] = c.color;
    const entrees: any[] = [];
    const sorties: any[] = [];
    for (const r of rows) {
      const item = { categorie: r.categorie, total: r.total, color: catColorMap[r.categorie] ?? colors.textSec };
      if (r.type === 'entree') entrees.push(item);
      else sorties.push(item);
    }
    return { entrees, sorties };
  }, [userId]);

  return {
    getMonthlySummary, getWeeklyBreakdown, getCategorieBreakdown,
    getEpargneEvolution, getTopDepenses, getEpargneSummary,
    getPreviousMonthSolde, getCategorieSummary,
  };
}
