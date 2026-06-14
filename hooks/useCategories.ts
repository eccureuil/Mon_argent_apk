import { api } from '../services/api';
import { getDb } from '../database/db';
import { CATEGORY_COLORS } from '../constants/colors';
import { courantCategories, factureCategories } from '../constants/categories';
import type { UserCategory } from '../types';

function slugify(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function cacheCategories(rows: UserCategory[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  for (const c of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO user_categories (id, user_id, value, label, icon, color, type, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      c.id, c.user_id, c.value, c.label, c.icon, c.color, c.type, c.sort_order
    );
  }
}

export async function seedDefaultCategories(userId: number): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_categories WHERE user_id = ?', userId
  );
  if (existing && existing.count > 0) return;
  const all: any[] = [];
  let colorIdx = 0;
  for (const c of courantCategories) {
    let type = 'both';
    if (['Salaire', 'Freelance', 'Vente', 'Remboursement'].includes(c.value)) type = 'entree';
    else if (c.value === 'Autre') type = 'both';
    else type = 'sortie';
    all.push({ value: c.value, label: c.label, icon: c.icon, color: CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length], type });
    colorIdx++;
  }
  for (const c of factureCategories) {
    if (c.value === 'Autre') continue;
    all.push({ value: c.value, label: c.label, icon: c.icon, color: CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length], type: 'facture' });
    colorIdx++;
  }
  for (let i = 0; i < all.length; i++) {
    await db.runAsync(
      `INSERT INTO user_categories (user_id, value, label, icon, color, type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      userId, all[i].value, all[i].label, all[i].icon, all[i].color, all[i].type, i
    );
  }
}

export async function getCategories(userId: number, type?: string): Promise<UserCategory[]> {
  const res = await api.get<UserCategory[]>(`/categories${type ? `?type=${type}` : ''}`);
  if (res.ok) {
    await cacheCategories(res.data);
    return res.data;
  }
  await seedDefaultCategories(userId);
  const db = await getDb();
  if (type) {
    return db.getAllAsync<UserCategory>(
      `SELECT * FROM user_categories WHERE user_id = ? AND (type = ? OR type = 'both') ORDER BY sort_order ASC`,
      userId, type
    );
  }
  return db.getAllAsync<UserCategory>(
    'SELECT * FROM user_categories WHERE user_id = ? ORDER BY sort_order ASC', userId
  );
}

export async function addCategory(
  userId: number, label: string, icon: string, type: string, color?: string
): Promise<number> {
  const res = await api.post('/categories', { label, icon, type, color });
  if (!res.ok) throw new Error(res.data.error || 'Erreur ajout catégorie');
  const cat = res.data as UserCategory;
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO user_categories (id, user_id, value, label, icon, color, type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    cat.id, userId, cat.value, cat.label, cat.icon, cat.color, cat.type, cat.sort_order
  );
  return cat.id;
}

export async function updateCategory(
  id: number, data: { label?: string; icon?: string; color?: string; type?: string }
): Promise<void> {
  const res = await api.put(`/categories/${id}`, data);
  if (!res.ok) throw new Error(res.data.error || 'Erreur modification');
  const db = await getDb();
  const sets: string[] = [];
  const params: any[] = [];
  if (data.label !== undefined) { sets.push('label = ?'); params.push(data.label); }
  if (data.icon !== undefined) { sets.push('icon = ?'); params.push(data.icon); }
  if (data.color !== undefined) { sets.push('color = ?'); params.push(data.color); }
  if (data.type !== undefined) { sets.push('type = ?'); params.push(data.type); }
  if (sets.length === 0) return;
  params.push(id);
  await db.runAsync(`UPDATE user_categories SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteCategory(userId: number, id: number): Promise<void> {
  const res = await api.delete(`/categories/${id}`);
  if (!res.ok) throw new Error(res.data.error || 'Erreur suppression');
  const db = await getDb();
  const cat = await db.getFirstAsync<UserCategory>(
    'SELECT * FROM user_categories WHERE id = ? AND user_id = ?', id, userId
  );
  if (cat) {
    await db.runAsync(
      "UPDATE courant_transactions SET categorie = 'Autre' WHERE user_id = ? AND categorie = ?",
      userId, cat.value
    );
    await db.runAsync(
      "UPDATE factures SET categorie = 'Autre' WHERE user_id = ? AND categorie = ?",
      userId, cat.value
    );
  }
  await db.runAsync('DELETE FROM user_categories WHERE id = ?', id);
}
