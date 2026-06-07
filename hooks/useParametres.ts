import { getDb } from '../database/db';
import type { RegleBudget, StockageType } from '../types';

/** Get a setting value by key for the given user. */
export async function getParametre(
  userId: number,
  cle: string
): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ valeur: string }>(
    'SELECT valeur FROM parametres WHERE user_id = ? AND cle = ?',
    userId,
    cle
  );
  return row?.valeur ?? null;
}

/** Upsert a key-value setting for the given user. */
export async function setParametre(
  userId: number,
  cle: string,
  valeur: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO parametres (user_id, cle, valeur) VALUES (?, ?, ?)`,
    userId,
    cle,
    valeur
  );
}

/** Get all budget rules for the user. */
export async function getReglesBudget(
  userId: number
): Promise<RegleBudget[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RegleBudget>(
    'SELECT * FROM regles_budget WHERE user_id = ? ORDER BY categorie',
    userId
  );
  return rows.map((r) => ({ ...r, periode: r.periode as 'mensuel' | 'hebdomadaire' }));
}

/** Create or replace a budget rule for a category. */
export async function upsertRegleBudget(
  userId: number,
  categorie: string,
  montant_max: number,
  periode: 'mensuel' | 'hebdomadaire'
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO regles_budget (user_id, categorie, montant_max, periode) VALUES (?, ?, ?, ?)`,
    userId,
    categorie,
    montant_max,
    periode
  );
}

/** Delete a budget rule by id (scoped to user). */
export async function deleteRegleBudget(
  userId: number,
  id: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM regles_budget WHERE id = ? AND user_id = ?',
    id,
    userId
  );
}

/** Check if spending for a category has exceeded the budget rule limit. */
export async function checkBudgetAlert(
  userId: number,
  categorie: string,
  stockage?: StockageType
): Promise<{
  depense: number;
  max: number;
  depasse: boolean;
  pourcentage: number;
} | null> {
  const db = await getDb();
  const rule = await db.getFirstAsync<RegleBudget>(
    'SELECT * FROM regles_budget WHERE user_id = ? AND categorie = ?',
    userId,
    categorie
  );
  if (!rule) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const weekStartStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString().split('T')[0];
  const dateParam = rule.periode === 'mensuel' ? monthStr : weekStartStr;
  const params: (string | number)[] = [userId, categorie, dateParam];
  if (stockage) params.push(stockage);

  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
     WHERE user_id = ? AND type = 'sortie' AND categorie = ?
     AND ${rule.periode === 'mensuel' ? "strftime('%Y-%m', date) = ?" : "date >= ?"}
     ${stockage ? 'AND stockage = ?' : ''}`,
    ...params
  );

  const depense = row?.total ?? 0;
  const pourcentage = rule.montant_max > 0 ? (depense / rule.montant_max) * 100 : 0;

  return {
    depense,
    max: rule.montant_max,
    depasse: depense > rule.montant_max,
    pourcentage: Math.round(pourcentage * 100) / 100,
  };
}
