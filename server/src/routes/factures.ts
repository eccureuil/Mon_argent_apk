import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import type { Facture } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await query<Facture>(
      `SELECT * FROM factures WHERE user_id = $1 ORDER BY payee ASC, date_echeance ASC`,
      [req.userId!]
    );
    const mapped = result.rows.map((r) => ({
      ...r,
      payee: Boolean(r.payee),
      notif_state: (r.notif_state ?? 0) as 0 | 1 | 2,
      recurrence: r.recurrence ?? null,
    }));
    res.json(mapped);
  } catch (err) {
    console.error('Factures list error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { titre, montant, categorie, description, date_echeance, recurrence } = req.body;
    const result = await query(
      `INSERT INTO factures (user_id, titre, montant, categorie, description, date_echeance, recurrence)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.userId!, titre, montant, categorie, description ?? null, date_echeance ?? null, recurrence ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Factures create error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { titre, montant, categorie, description, date_echeance, recurrence } = req.body;
    await query(
      `UPDATE factures SET titre = $1, montant = $2, categorie = $3, description = $4,
       date_echeance = $5, recurrence = $6
       WHERE id = $7 AND user_id = $8 AND payee = FALSE`,
      [titre, montant, categorie, description ?? null, date_echeance ?? null, recurrence ?? null, req.params.id, req.userId!]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Factures update error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'DELETE FROM factures WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId!]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Factures delete error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/:id/payer', async (req: AuthRequest, res: Response) => {
  try {
    const { montant, titre, categorie, stockage } = req.body;
    const now = new Date().toISOString();

    const txResult = await query(
      `INSERT INTO courant_transactions (user_id, type, stockage, montant, description, categorie, date, source, facture_id)
       VALUES ($1, 'sortie', $2, $3, $4, $5, $6, 'facture', $7) RETURNING id`,
      [req.userId!, stockage, montant, `Paiement facture: ${titre}`, categorie, now, req.params.id]
    );

    const txId = txResult.rows[0].id;

    await query(
      `UPDATE factures SET payee = TRUE, date_paiement = $1, courant_transaction_id = $2
       WHERE id = $3 AND user_id = $4`,
      [now, txId, req.params.id, req.userId!]
    );

    res.json({ success: true, transaction_id: txId });
  } catch (err) {
    console.error('Factures payer error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/recurring/create', async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const rows = await query(
      `SELECT * FROM factures
       WHERE user_id = $1 AND recurrence = 'mensuel' AND payee = TRUE
       AND date_paiement < $2`,
      [req.userId!, firstOfMonth]
    );

    let created = 0;
    for (const row of rows.rows) {
      const echeance = row.date_echeance ? new Date(row.date_echeance) : new Date();
      echeance.setMonth(echeance.getMonth() + 1);
      const newEcheance = echeance.toISOString().slice(0, 10);

      const existing = await query(
        `SELECT id FROM factures
         WHERE user_id = $1 AND titre = $2 AND recurrence = 'mensuel'
         AND date_echeance = $3 AND payee = FALSE`,
        [req.userId!, row.titre, newEcheance]
      );

      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO factures (user_id, titre, montant, categorie, description, date_echeance, recurrence)
           VALUES ($1, $2, $3, $4, $5, $6, 'mensuel')`,
          [req.userId!, row.titre, row.montant, row.categorie, row.description, newEcheance]
        );
        created++;
      }
    }

    res.json({ created });
  } catch (err) {
    console.error('Factures recurring error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
