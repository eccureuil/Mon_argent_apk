import { api } from '../services/api';
import { getDb } from '../database/db';
import type { RegleBudget, StockageType } from '../types';

export async function getParametre(userId: number, cle: string): Promise<string | null> {
  const res = await api.get<{ valeur: string | null }>(`/parametres/${cle}`);
  if (res.ok) {
    const db = await getDb();
    if (res.data.valeur !== null) {
      await db.runAsync(
        'INSERT OR REPLACE INTO parametres (user_id, cle, valeur) VALUES (?, ?, ?)',
        userId, cle, res.data.valeur
      );
    }
    return res.data.valeur;
  }
  const db = await getDb();
  const row = await db.getFirstAsync<{ valeur: string }>(
    'SELECT valeur FROM parametres WHERE user_id = ? AND cle = ?', userId, cle
  );
  return row?.valeur ?? null;
}

export async function setParametre(userId: number, cle: string, valeur: string): Promise<void> {
  const res = await api.put(`/parametres/${cle}`, { valeur });
  if (!res.ok) throw new Error(res.data.error || 'Erreur sauvegarde');
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO parametres (user_id, cle, valeur) VALUES (?, ?, ?)',
    userId, cle, valeur
  );
}

export async function getReglesBudget(userId: number): Promise<RegleBudget[]> {
  const res = await api.get<RegleBudget[]>('/parametres/regles-budget/list');
  if (res.ok) {
    const db = await getDb();
    for (const r of res.data) {
      await db.runAsync(
        'INSERT OR REPLACE INTO regles_budget (id, user_id, categorie, montant_max, periode) VALUES (?, ?, ?, ?, ?)',
        r.id, userId, r.categorie, r.montant_max, r.periode
      );
    }
    return res.data.map((r) => ({ ...r, periode: r.periode as 'mensuel' | 'hebdomadaire' }));
  }
  const db = await getDb();
  const rows = await db.getAllAsync<RegleBudget>(
    'SELECT * FROM regles_budget WHERE user_id = ? ORDER BY categorie', userId
  );
  return rows.map((r) => ({ ...r, periode: r.periode as 'mensuel' | 'hebdomadaire' }));
}

export async function upsertRegleBudget(
  userId: number, categorie: string, montant_max: number, periode: 'mensuel' | 'hebdomadaire'
): Promise<void> {
  const res = await api.post('/parametres/regles-budget', { categorie, montant_max, periode });
  if (!res.ok) throw new Error(res.data.error || 'Erreur sauvegarde');
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO regles_budget (user_id, categorie, montant_max, periode) VALUES (?, ?, ?, ?)',
    userId, categorie, montant_max, periode
  );
}

export async function deleteRegleBudget(userId: number, id: number): Promise<void> {
  const res = await api.delete(`/parametres/regles-budget/${id}`);
  if (!res.ok) throw new Error(res.data.error || 'Erreur suppression');
  const db = await getDb();
  await db.runAsync('DELETE FROM regles_budget WHERE id = ? AND user_id = ?', id, userId);
}

export async function checkBudgetAlert(
  userId: number, categorie: string, stockage?: StockageType
): Promise<{
  depense: number; max: number; depasse: boolean; pourcentage: number;
} | null> {
  const path = `/parametres/budget-alert?categorie=${categorie}${stockage ? `&stockage=${stockage}` : ''}`;
  const res = await api.get<any>(path);
  if (res.ok) return res.data;
  const db = await getDb();
  const rule = await db.getFirstAsync<RegleBudget>(
    'SELECT * FROM regles_budget WHERE user_id = ? AND categorie = ?', userId, categorie
  );
  if (!rule) return null;
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const weekStartStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString().split('T')[0];
  const dateParam = rule.periode === 'mensuel' ? monthStr : weekStartStr;
  const params: (string | number)[] = [userId, categorie, dateParam];
  if (stockage) params.push(stockage);
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
     WHERE user_id = ? AND type = 'sortie' AND categorie = ?
     AND ${rule.periode === 'mensuel' ? "strftime('%Y-%m', date) = ?" : 'date >= ?'}
     ${stockage ? 'AND stockage = ?' : ''}`,
    ...params
  );
  const depense = row?.total ?? 0;
  const pourcentage = rule.montant_max > 0 ? (depense / rule.montant_max) * 100 : 0;
  return {
    depense, max: rule.montant_max,
    depasse: depense > rule.montant_max,
    pourcentage: Math.round(pourcentage * 100) / 100,
  };
}
