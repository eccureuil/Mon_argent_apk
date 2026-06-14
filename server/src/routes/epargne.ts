import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import type { EpargneTransaction } from '../types';

const router = Router();
router.use(authenticate);

router.get('/solde', async (req: AuthRequest, res: Response) => {
  try {
    const entrees = await query(
      `SELECT COALESCE(SUM(montant), 0) as total FROM epargne_transactions
       WHERE user_id = $1 AND type = 'entree'`,
      [req.userId!]
    );
    const sorties = await query(
      `SELECT COALESCE(SUM(montant), 0) as total FROM epargne_transactions
       WHERE user_id = $1 AND type = 'sortie'`,
      [req.userId!]
    );
    const solde = parseFloat(entrees.rows[0]?.total ?? '0') - parseFloat(sorties.rows[0]?.total ?? '0');
    res.json({ solde });
  } catch (err) {
    console.error('Epargne solde error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year, all } = req.query;
    let rows;

    if (all === 'true') {
      rows = await query<EpargneTransaction>(
        'SELECT * FROM epargne_transactions WHERE user_id = $1 ORDER BY date DESC',
        [req.userId!]
      );
    } else if (month && year) {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      rows = await query<EpargneTransaction>(
        `SELECT * FROM epargne_transactions
         WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2
         ORDER BY date DESC`,
        [req.userId!, monthStr]
      );
    } else {
      res.status(400).json({ error: 'Paramètres month et year ou all requis' });
      return;
    }

    res.json(rows.rows);
  } catch (err) {
    console.error('Epargne transactions error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const { type, montant, date, description } = req.body;
    const result = await query(
      `INSERT INTO epargne_transactions (user_id, type, montant, description, date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId!, type, montant, description ?? null, date ?? new Date().toISOString()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Epargne create error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/transactions/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'DELETE FROM epargne_transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId!]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Epargne delete error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
