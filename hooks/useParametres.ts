import { getDb } from '../database/db';
import type { RegleBudget, StockageType } from '../types';

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
  let dateFilter: string;
  if (rule.periode === 'mensuel') {
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    dateFilter = `strftime('%Y-%m', date) = '${monthStr}'`;
  } else {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    dateFilter = `date >= '${weekStartStr}'`;
  }

  const stockageFilter = stockage ? ` AND stockage = '${stockage}'` : '';

  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
     WHERE user_id = ? AND type = 'sortie' AND categorie = ? AND ${dateFilter}${stockageFilter}`,
    userId,
    categorie
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
