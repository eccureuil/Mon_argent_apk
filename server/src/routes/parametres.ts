import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/:key', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT valeur FROM parametres WHERE user_id = $1 AND cle = $2',
      [req.userId!, req.params.key]
    );
    res.json({ valeur: result.rows[0]?.valeur ?? null });
  } catch (err) {
    console.error('Parametres get error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:key', async (req: AuthRequest, res: Response) => {
  try {
    const { valeur } = req.body;
    await query(
      `INSERT INTO parametres (user_id, cle, valeur) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, cle) DO UPDATE SET valeur = $3`,
      [req.userId!, req.params.key, valeur]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Parametres set error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/regles-budget/list', async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query(
      'SELECT * FROM regles_budget WHERE user_id = $1 ORDER BY categorie',
      [req.userId!]
    );
    res.json(rows.rows);
  } catch (err) {
    console.error('Regles budget list error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/regles-budget', async (req: AuthRequest, res: Response) => {
  try {
    const { categorie, montant_max, periode } = req.body;
    await query(
      `INSERT INTO regles_budget (user_id, categorie, montant_max, periode) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, categorie) DO UPDATE SET montant_max = $3, periode = $4`,
      [req.userId!, categorie, montant_max, periode]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Regles budget upsert error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/regles-budget/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'DELETE FROM regles_budget WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId!]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Regles budget delete error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/budget-alert', async (req: AuthRequest, res: Response) => {
  try {
    const { categorie, stockage } = req.query;

    const rule = await query(
      'SELECT * FROM regles_budget WHERE user_id = $1 AND categorie = $2',
      [req.userId!, categorie]
    );

    if (rule.rows.length === 0) {
      res.json(null);
      return;
    }

    const r = rule.rows[0];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString().split('T')[0];

    let dateCondition: string;
    let dateParam: string;
    if (r.periode === 'mensuel') {
      dateCondition = "to_char(date, 'YYYY-MM') = $3";
      dateParam = monthStr;
    } else {
      dateCondition = 'date >= $3';
      dateParam = weekStart;
    }

    const params: any[] = [req.userId!, categorie, dateParam];
    let stockageJoin = '';
    if (stockage) {
      stockageJoin = 'AND stockage = $4';
      params.push(stockage);
    }

    const depenseResult = await query(
      `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
       WHERE user_id = $1 AND type = 'sortie' AND categorie = $2 AND ${dateCondition} ${stockageJoin}`,
      params
    );

    const depense = parseFloat(depenseResult.rows[0]?.total ?? '0');
    const max = parseFloat(r.montant_max);
    const pourcentage = max > 0 ? (depense / max) * 100 : 0;

    res.json({
      depense,
      max,
      depasse: depense > max,
      pourcentage: Math.round(pourcentage * 100) / 100,
    });
  } catch (err) {
    console.error('Budget alert error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
