import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import type { CourantTransaction, StockageType, SoldeByStockage } from '../types';

const router = Router();
router.use(authenticate);

router.get('/solde', async (req: AuthRequest, res: Response) => {
  try {
    const stockages: StockageType[] = ['espece', 'mobile_money', 'banque'];
    const result: SoldeByStockage = { espece: 0, mobile_money: 0, banque: 0, total: 0 };

    for (const s of stockages) {
      const entrees = await query(
        `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
         WHERE user_id = $1 AND stockage = $2 AND type = 'entree'`,
        [req.userId!, s]
      );
      const sorties = await query(
        `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
         WHERE user_id = $1 AND stockage = $2 AND type = 'sortie'`,
        [req.userId!, s]
      );
      const solde = (parseFloat(entrees.rows[0]?.total ?? '0')) - (parseFloat(sorties.rows[0]?.total ?? '0'));
      result[s] = solde;
    }

    result.total = result.espece + result.mobile_money + result.banque;
    res.json(result);
  } catch (err) {
    console.error('Courant solde error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const { stockage, month, year } = req.query;
    let rows;

    if (stockage && month && year) {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      rows = await query<CourantTransaction>(
        `SELECT * FROM courant_transactions
         WHERE user_id = $1 AND stockage = $2 AND to_char(date, 'YYYY-MM') = $3
         ORDER BY date DESC`,
        [req.userId!, stockage, monthStr]
      );
    } else if (month && year) {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      rows = await query<CourantTransaction>(
        `SELECT * FROM courant_transactions
         WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2
         ORDER BY date DESC`,
        [req.userId!, monthStr]
      );
    } else {
      res.status(400).json({ error: 'Paramètres month et year requis' });
      return;
    }

    res.json(rows.rows);
  } catch (err) {
    console.error('Courant transactions error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const { type, stockage, montant, categorie, date, description } = req.body;
    const result = await query(
      `INSERT INTO courant_transactions (user_id, type, stockage, montant, description, categorie, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.userId!, type, stockage, montant, description ?? null, categorie, date ?? new Date().toISOString()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Courant create error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/transactions/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'DELETE FROM courant_transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId!]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Courant delete error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/transfers/:id/pair', async (req: AuthRequest, res: Response) => {
  try {
    const txResult = await query<CourantTransaction>(
      'SELECT * FROM courant_transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId!]
    );
    if (txResult.rows.length === 0) {
      res.json(null);
      return;
    }

    const tx = txResult.rows[0];
    if (!tx.description) {
      res.json(null);
      return;
    }

    const stockageLabels: Record<string, string> = {
      espece: 'Espèces',
      mobile_money: 'Mobile Money',
      banque: 'Banque',
    };

    const versMatch = tx.description.match(/^Transfert vers (.+?)(?:\s+\+ frais de transaction)?$/);
    if (versMatch) {
      const result = await query(
        `SELECT id FROM courant_transactions
         WHERE user_id = $1 AND type = 'entree' AND date = $2 AND description = $3
         LIMIT 1`,
        [req.userId!, tx.date, `Transfert depuis ${stockageLabels[tx.stockage]}`]
      );
      res.json(result.rows.length > 0 ? { id: result.rows[0].id, cible: versMatch[1] } : null);
      return;
    }

    const depuisMatch = tx.description.match(/^Transfert depuis (.+?)$/);
    if (depuisMatch) {
      const result = await query(
        `SELECT id FROM courant_transactions
         WHERE user_id = $1 AND type = 'sortie' AND date = $2 AND (description = $3 OR description = $4)
         LIMIT 1`,
        [req.userId!, tx.date, `Transfert vers ${stockageLabels[tx.stockage]}`, `Transfert vers ${stockageLabels[tx.stockage]} + frais de transaction`]
      );
      res.json(result.rows.length > 0 ? { id: result.rows[0].id, cible: depuisMatch[1] } : null);
      return;
    }

    res.json(null);
  } catch (err) {
    console.error('Courant transfer pair error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/transfer-to-epargne', async (req: AuthRequest, res: Response) => {
  try {
    const { stockage, montant, date } = req.body;
    const nowStr = date || new Date().toISOString();

    const txResult = await query(
      `INSERT INTO courant_transactions (user_id, type, stockage, montant, description, categorie, date)
       VALUES ($1, 'sortie', $2, $3, 'Transfert vers Épargne', 'Transfert', $4) RETURNING id`,
      [req.userId!, stockage, montant, nowStr]
    );

    const epargneResult = await query(
      `INSERT INTO epargne_transactions (user_id, type, montant, description, date)
       VALUES ($1, 'entree', $2, 'Transfert depuis Courant', $3) RETURNING id`,
      [req.userId!, montant, nowStr]
    );

    res.status(201).json({
      courant_transaction_id: txResult.rows[0].id,
      epargne_transaction_id: epargneResult.rows[0].id,
    });
  } catch (err) {
    console.error('Courant transfer to epargne error:', err);
    res.status(500).json({ error: 'Erreur transfert' });
  }
});

export default router;
