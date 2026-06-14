import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const CATEGORY_COLORS = [
  '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE',
  '#5AC8FA', '#FF2D55', '#5856D6', '#FFD60A', '#32D74B',
  '#64D2FF', '#FF9F0A',
];

const courantCategories = [
  { value: 'Salaire', label: 'Salaire', icon: 'briefcase' },
  { value: 'Freelance', label: 'Freelance', icon: 'laptop' },
  { value: 'Remboursement', label: 'Remboursement', icon: 'cash-back' },
  { value: 'Vente', label: 'Vente', icon: 'cart' },
  { value: 'Alimentation', label: 'Alimentation', icon: 'restaurant' },
  { value: 'Transport', label: 'Transport', icon: 'car' },
  { value: 'Logement', label: 'Logement', icon: 'home' },
  { value: 'Santé', label: 'Santé', icon: 'medkit' },
  { value: 'Loisirs', label: 'Loisirs', icon: 'game-controller' },
  { value: 'Facture', label: 'Facture', icon: 'document-text' },
  { value: 'Transfert', label: 'Transfert', icon: 'swap-horizontal' },
  { value: 'Autre', label: 'Autre', icon: 'ellipsis-horizontal' },
];

const factureCategories = [
  { value: 'Loyer', label: 'Loyer', icon: 'home' },
  { value: 'Électricité', label: 'Électricité', icon: 'flash' },
  { value: 'Eau', label: 'Eau', icon: 'water' },
  { value: 'Internet', label: 'Internet', icon: 'globe' },
  { value: 'Abonnement', label: 'Abonnement', icon: 'newspaper' },
  { value: 'Assurance', label: 'Assurance', icon: 'shield-checkmark' },
  { value: 'Impôt', label: 'Impôt', icon: 'calculator' },
];

function seedDefaultCategories(userId: number): Promise<void> {
  return seedCategories(userId);
}

async function seedCategories(userId: number): Promise<void> {
  const existing = await query(
    'SELECT COUNT(*) as count FROM user_categories WHERE user_id = $1',
    [userId]
  );
  if (parseInt(existing.rows[0]?.count ?? '0') > 0) return;

  const all: any[] = [];
  let colorIdx = 0;

  for (const c of courantCategories) {
    let type = 'both';
    if (['Salaire', 'Freelance', 'Vente', 'Remboursement'].includes(c.value)) {
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
      sort_order: colorIdx,
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
      sort_order: colorIdx,
    });
    colorIdx++;
  }

  for (const item of all) {
    await query(
      `INSERT INTO user_categories (user_id, value, label, icon, color, type, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, item.value, item.label, item.icon, item.color, item.type, item.sort_order]
    );
  }
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    await seedDefaultCategories(req.userId!);
    const { type } = req.query;
    let rows;

    if (type) {
      rows = await query(
        `SELECT * FROM user_categories WHERE user_id = $1 AND (type = $2 OR type = 'both') ORDER BY sort_order ASC`,
        [req.userId!, type]
      );
    } else {
      rows = await query(
        'SELECT * FROM user_categories WHERE user_id = $1 ORDER BY sort_order ASC',
        [req.userId!]
      );
    }

    res.json(rows.rows);
  } catch (err) {
    console.error('Categories list error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { label, icon, type, color } = req.body;
    const value = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const existingColors = await query(
      'SELECT color FROM user_categories WHERE user_id = $1', [req.userId!]
    );
    const usedColors = new Set(existingColors.rows.map((r: any) => r.color));
    const catColor = color ?? CATEGORY_COLORS.find((c) => !usedColors.has(c)) ?? '#636366';

    const maxOrder = await query(
      'SELECT MAX(sort_order) as m FROM user_categories WHERE user_id = $1', [req.userId!]
    );
    const order = (maxOrder.rows[0]?.m ?? -1) + 1;

    const result = await query(
      `INSERT INTO user_categories (user_id, value, label, icon, color, type, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.userId!, value, label, icon, catColor, type, order]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Categories create error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { label, icon, color, type } = req.body;
    const sets: string[] = [];
    const params: any[] = [];

    if (label !== undefined) { sets.push('label = $' + (params.length + 1)); params.push(label); }
    if (icon !== undefined) { sets.push('icon = $' + (params.length + 1)); params.push(icon); }
    if (color !== undefined) { sets.push('color = $' + (params.length + 1)); params.push(color); }
    if (type !== undefined) { sets.push('type = $' + (params.length + 1)); params.push(type); }

    if (sets.length === 0) {
      res.json({ success: true });
      return;
    }

    params.push(req.params.id);
    await query(
      `UPDATE user_categories SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Categories update error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const cat = await query(
      'SELECT * FROM user_categories WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId!]
    );

    if (cat.rows.length > 0) {
      await query(
        'UPDATE courant_transactions SET categorie = $1 WHERE user_id = $2 AND categorie = $3',
        ['Autre', req.userId!, cat.rows[0].value]
      );
      await query(
        'UPDATE factures SET categorie = $1 WHERE user_id = $2 AND categorie = $3',
        ['Autre', req.userId!, cat.rows[0].value]
      );
    }

    await query('DELETE FROM user_categories WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Categories delete error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
