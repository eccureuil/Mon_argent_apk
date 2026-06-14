import { getDb } from '../database/db';
import { api } from './api';
import type {
  CourantTransaction,
  EpargneTransaction,
  Facture,
  RegleBudget,
  UserCategory,
} from '../types';

interface MigrationProgress {
  current: number;
  total: number;
  label: string;
}

type OnProgress = (p: MigrationProgress) => void;

async function pushBatch<T>(
  items: T[],
  apiFn: (item: T) => Promise<void>,
  label: string,
  onProgress: OnProgress,
  total: number,
  startCount: number
): Promise<number> {
  let done = 0;
  for (const item of items) {
    await apiFn(item);
    done++;
    onProgress({ current: startCount + done, total, label });
  }
  return items.length;
}

export async function importLocalData(
  oldUserId: number,
  onProgress: OnProgress
): Promise<void> {
  const db = await getDb();

  const categories = await db.getAllAsync<UserCategory>(
    'SELECT * FROM user_categories WHERE user_id = ? ORDER BY sort_order',
    oldUserId
  );
  const courant = await db.getAllAsync<CourantTransaction>(
    'SELECT * FROM courant_transactions WHERE user_id = ? ORDER BY date ASC',
    oldUserId
  );
  const epargne = await db.getAllAsync<EpargneTransaction>(
    'SELECT * FROM epargne_transactions WHERE user_id = ? ORDER BY date ASC',
    oldUserId
  );
  const factures = await db.getAllAsync<Facture>(
    'SELECT * FROM factures WHERE user_id = ? ORDER BY id',
    oldUserId
  );
  const regles = await db.getAllAsync<RegleBudget>(
    'SELECT * FROM regles_budget WHERE user_id = ?',
    oldUserId
  );
  const parametres = await db.getAllAsync<{ cle: string; valeur: string }>(
    'SELECT cle, valeur FROM parametres WHERE user_id = ?',
    oldUserId
  );

  const total =
    categories.length +
    courant.length +
    epargne.length +
    factures.length +
    regles.length +
    parametres.length;

  if (total === 0) {
    onProgress({ current: 0, total: 1, label: 'Aucune donnée locale trouvée' });
    return;
  }

  let done = 0;

  done += await pushBatch(
    categories,
    async (c) => {
      await api.post('/categories', {
        label: c.label,
        icon: c.icon,
        type: c.type,
        color: c.color,
      });
    },
    'Catégories',
    onProgress,
    total,
    done
  );

  done += await pushBatch(
    courant,
    async (t) => {
      await api.post('/courant/transactions', {
        type: t.type,
        stockage: t.stockage,
        montant: t.montant,
        categorie: t.categorie,
        date: t.date,
        description: t.description,
      });
    },
    'Transactions courantes',
    onProgress,
    total,
    done
  );

  done += await pushBatch(
    epargne,
    async (t) => {
      await api.post('/epargne/transactions', {
        type: t.type,
        montant: t.montant,
        date: t.date,
        description: t.description,
      });
    },
    'Transactions épargne',
    onProgress,
    total,
    done
  );

  done += await pushBatch(
    factures,
    async (f) => {
      await api.post('/factures', {
        titre: f.titre,
        montant: f.montant,
        categorie: f.categorie,
        description: f.description,
        date_echeance: f.date_echeance,
        recurrence: f.recurrence ?? null,
      });
    },
    'Factures',
    onProgress,
    total,
    done
  );

  done += await pushBatch(
    regles,
    async (r) => {
      await api.post('/parametres/regles-budget', {
        categorie: r.categorie,
        montant_max: r.montant_max,
        periode: r.periode,
      });
    },
    'Règles budget',
    onProgress,
    total,
    done
  );

  for (const p of parametres) {
    await api.put(`/parametres/${p.cle}`, { valeur: p.valeur });
    done++;
    onProgress({ current: done, total, label: 'Paramètres' });
  }

  onProgress({ current: total, total, label: 'Import terminé !' });
}
