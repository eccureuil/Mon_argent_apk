import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

function getMonthStr(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

router.get('/monthly-summary', async (req: AuthRequest, res: Response) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    const ms = getMonthStr(month, year);

    const entrees = await query(
      `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
       WHERE user_id = $1 AND type = 'entree' AND to_char(date, 'YYYY-MM') = $2`,
      [req.userId!, ms]
    );
    const sorties = await query(
      `SELECT COALESCE(SUM(montant), 0) as total FROM courant_transactions
       WHERE user_id = $1 AND type = 'sortie' AND to_char(date, 'YYYY-MM') = $2`,
      [req.userId!, ms]
    );

    const total_entrees = parseFloat(entrees.rows[0]?.total ?? '0');
    const total_sorties = parseFloat(sorties.rows[0]?.total ?? '0');
    res.json({ total_entrees, total_sorties, solde_net: total_entrees - total_sorties });
  } catch (err) {
    console.error('Rapport monthly-summary error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/weekly-breakdown', async (req: AuthRequest, res: Response) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    const ms = getMonthStr(month, year);

    const rows = await query(
      `SELECT EXTRACT(WEEK FROM date) as week, type, COALESCE(SUM(montant), 0) as total
       FROM courant_transactions
       WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2
       GROUP BY week, type
       ORDER BY week`,
      [req.userId!, ms]
    );

    const weekMap = new Map<number, { week: number; entrees: number; sorties: number }>();
    for (const row of rows.rows) {
      const w = parseInt(row.week);
      if (!weekMap.has(w)) weekMap.set(w, { week: w, entrees: 0, sorties: 0 });
      const entry = weekMap.get(w)!;
      if (row.type === 'entree') entry.entrees = parseFloat(row.total);
      else entry.sorties = parseFloat(row.total);
    }

    res.json(Array.from(weekMap.values()).sort((a, b) => a.week - b.week));
  } catch (err) {
    console.error('Rapport weekly-breakdown error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/categorie-breakdown', async (req: AuthRequest, res: Response) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    const ms = getMonthStr(month, year);

    const rows = await query(
      `SELECT categorie, COALESCE(SUM(montant), 0) as total
       FROM courant_transactions
       WHERE user_id = $1 AND type = 'sortie' AND to_char(date, 'YYYY-MM') = $2
       GROUP BY categorie
       ORDER BY total DESC`,
      [req.userId!, ms]
    );

    const grandTotal = rows.rows.reduce((sum: number, r: any) => sum + parseFloat(r.total), 0);

    const catColors = await query(
      'SELECT value, color FROM user_categories WHERE user_id = $1',
      [req.userId!]
    );
    const colorMap: Record<string, string> = {};
    for (const c of catColors.rows) colorMap[c.value] = c.color;

    const result = rows.rows.map((r: any) => ({
      categorie: r.categorie,
      montant: parseFloat(r.total),
      percentage: grandTotal > 0 ? (parseFloat(r.total) / grandTotal) * 100 : 0,
      color: colorMap[r.categorie] ?? '#636366',
    }));

    res.json(result);
  } catch (err) {
    console.error('Rapport categorie-breakdown error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/categorie-summary', async (req: AuthRequest, res: Response) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    const ms = getMonthStr(month, year);

    const rows = await query(
      `SELECT type, categorie, COALESCE(SUM(montant), 0) as total
       FROM courant_transactions
       WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2
       GROUP BY type, categorie
       ORDER BY type, total DESC`,
      [req.userId!, ms]
    );

    const catColors = await query(
      'SELECT value, color FROM user_categories WHERE user_id = $1',
      [req.userId!]
    );
    const colorMap: Record<string, string> = {};
    for (const c of catColors.rows) colorMap[c.value] = c.color;

    const entrees: any[] = [];
    const sorties: any[] = [];
    for (const r of rows.rows) {
      const item = { categorie: r.categorie, total: parseFloat(r.total), color: colorMap[r.categorie] ?? '#636366' };
      if (r.type === 'entree') entrees.push(item);
      else sorties.push(item);
    }

    res.json({ entrees, sorties });
  } catch (err) {
    console.error('Rapport categorie-summary error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/epargne-evolution', async (req: AuthRequest, res: Response) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    const ms = getMonthStr(month, year);

    const rows = await query(
      `SELECT date, type, montant FROM epargne_transactions
       WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2
       ORDER BY date ASC`,
      [req.userId!, ms]
    );

    const dailyMap = new Map<string, number>();
    let runningSolde = 0;

    for (const row of rows.rows) {
      const day = (row.date as string).substring(0, 10);
      if (row.type === 'entree') runningSolde += parseFloat(row.montant);
      else runningSolde -= parseFloat(row.montant);
      dailyMap.set(day, runningSolde);
    }

    const result = Array.from(dailyMap.entries()).map(([date, solde]) => ({ date, solde }));
    res.json(result);
  } catch (err) {
    console.error('Rapport epargne-evolution error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/top-depenses', async (req: AuthRequest, res: Response) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    const limit = parseInt((req.query.limit as string) || '5');
    const ms = getMonthStr(month, year);

    const rows = await query(
      `SELECT id, montant, description, categorie, date FROM courant_transactions
       WHERE user_id = $1 AND type = 'sortie' AND to_char(date, 'YYYY-MM') = $2
       ORDER BY montant DESC LIMIT $3`,
      [req.userId!, ms, limit]
    );

    res.json(rows.rows);
  } catch (err) {
    console.error('Rapport top-depenses error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/epargne-summary', async (req: AuthRequest, res: Response) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    const ms = getMonthStr(month, year);

    const entrees = await query(
      `SELECT COALESCE(SUM(montant), 0) as total FROM epargne_transactions
       WHERE user_id = $1 AND type = 'entree' AND to_char(date, 'YYYY-MM') = $2`,
      [req.userId!, ms]
    );
    const sorties = await query(
      `SELECT COALESCE(SUM(montant), 0) as total FROM epargne_transactions
       WHERE user_id = $1 AND type = 'sortie' AND to_char(date, 'YYYY-MM') = $2`,
      [req.userId!, ms]
    );

    const total_entrees = parseFloat(entrees.rows[0]?.total ?? '0');
    const total_sorties = parseFloat(sorties.rows[0]?.total ?? '0');
    res.json({ total_entrees, total_sorties, solde_net: total_entrees - total_sorties });
  } catch (err) {
    console.error('Rapport epargne-summary error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/previous-month-solde', async (req: AuthRequest, res: Response) => {
  try {
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;

    const courant = await query(
      `SELECT COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE -montant END), 0) as solde
       FROM courant_transactions WHERE user_id = $1 AND date < $2`,
      [req.userId!, firstDay]
    );
    const epargne = await query(
      `SELECT COALESCE(SUM(CASE WHEN type = 'entree' THEN montant ELSE -montant END), 0) as solde
       FROM epargne_transactions WHERE user_id = $1 AND date < $2`,
      [req.userId!, firstDay]
    );

    res.json({
      courant: parseFloat(courant.rows[0]?.solde ?? '0'),
      epargne: parseFloat(epargne.rows[0]?.solde ?? '0'),
    });
  } catch (err) {
    console.error('Rapport previous-month-solde error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
