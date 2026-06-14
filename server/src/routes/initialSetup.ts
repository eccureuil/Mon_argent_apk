import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { espece, mobile_money, banque, epargne } = req.body;
    const now = new Date().toISOString();

    const wallets: { stockage: string; montant: number }[] = [
      { stockage: 'espece', montant: parseFloat(espece || '0') },
      { stockage: 'mobile_money', montant: parseFloat(mobile_money || '0') },
      { stockage: 'banque', montant: parseFloat(banque || '0') },
    ];

    for (const w of wallets) {
      if (w.montant > 0) {
        await query(
          `INSERT INTO courant_transactions (user_id, type, stockage, montant, description, categorie, date)
           VALUES ($1, 'entree', $2, $3, 'Solde initial', 'Autre', $4)`,
          [req.userId!, w.stockage, w.montant, now]
        );
      }
    }

    const epargneMontant = parseFloat(epargne || '0');
    if (epargneMontant > 0) {
      await query(
        `INSERT INTO epargne_transactions (user_id, type, montant, description, date)
         VALUES ($1, 'entree', $2, 'Solde initial', $3)`,
        [req.userId!, epargneMontant, now]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Initial setup error:', err);
    res.status(500).json({ error: 'Erreur initialisation' });
  }
});

export default router;
