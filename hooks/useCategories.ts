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

export async function seedDefaultCategories(userId: number): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_categories WHERE user_id = ?',
    userId
  );
  if (existing && existing.count > 0) return;

  const all: { value: string; label: string; icon: string; color: string; type: string }[] = [];
  let colorIdx = 0;

  for (const c of courantCategories) {
    let type = 'both';
    if (c.value === 'Salaire' || c.value === 'Freelance' || c.value === 'Vente' || c.value === 'Remboursement') {
      type = 'entree';
    } else if (c.value === 'Autre') {
      type = 'both';
    } else {
      type = 'sortie';
    }
    all.push({
      value: c.value,
      label: c.label,
      icon: c.icon,
      color: CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length],
      type,
    });
    colorIdx++;
  }

  for (const c of factureCategories) {
    if (c.value === 'Autre') continue;
    all.push({
      value: c.value,
      label: c.label,
      icon: c.icon,
      color: CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length],
      type: 'facture',
    });
    colorIdx++;
  }

  for (let i = 0; i < all.length; i++) {
    await db.runAsync(
      `INSERT INTO user_categories (user_id, value, label, icon, color, type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      userId, all[i].value, all[i].label, all[i].icon, all[i].color, all[i].type, i
    );
  }
}

export async function getCategories(
  userId: number,
  type?: string
): Promise<UserCategory[]> {
  await seedDefaultCategories(userId);
  const db = await getDb();
  let rows: UserCategory[];
  if (type) {
    rows = await db.getAllAsync<UserCategory>(
      `SELECT * FROM user_categories WHERE user_id = ? AND (type = ? OR type = 'both') ORDER BY sort_order ASC`,
      userId, type
    );
  } else {
    rows = await db.getAllAsync<UserCategory>(
      'SELECT * FROM user_categories WHERE user_id = ? ORDER BY sort_order ASC',
      userId
    );
  }
  return rows;
}

export async function addCategory(
  userId: number,
  label: string,
  icon: string,
  type: string,
  color?: string
): Promise<number> {
  const db = await getDb();
  const value = slugify(label);
  const existingColors = await db.getAllAsync<{ color: string }>(
    'SELECT color FROM user_categories WHERE user_id = ?', userId
  );
  const usedColors = new Set(existingColors.map(r => r.color));
  const catColor = color ?? CATEGORY_COLORS.find(c => !usedColors.has(c)) ?? '#636366';
  const maxOrder = await db.getFirstAsync<{ m: number }>(
    'SELECT MAX(sort_order) as m FROM user_categories WHERE user_id = ?', userId
  );
  const order = (maxOrder?.m ?? -1) + 1;
  const result = await db.runAsync(
    `INSERT INTO user_categories (user_id, value, label, icon, color, type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    userId, value, label, icon, catColor, type, order
  );
  return result.lastInsertRowId as number;
}

export async function updateCategory(
  id: number,
  data: { label?: string; icon?: string; color?: string; type?: string }
): Promise<void> {
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
  const db = await getDb();
  const cat = await db.getFirstAsync<UserCategory>(
    'SELECT * FROM user_categories WHERE id = ? AND user_id = ?', id, userId
  );
  if (!cat) return;
  await db.runAsync(
    'UPDATE courant_transactions SET categorie = ? WHERE user_id = ? AND categorie = ?',
    'Autre', userId, cat.value
  );
  await db.runAsync(
    'UPDATE factures SET categorie = ? WHERE user_id = ? AND categorie = ?',
    'Autre', userId, cat.value
  );
  await db.runAsync('DELETE FROM user_categories WHERE id = ?', id);
}


