import { useCallback } from 'react';
import { api } from '../services/api';
import { getDb } from '../database/db';
import type { Facture, StockageType, NotifState } from '../types';

async function cacheFactures(rows: Facture[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  for (const f of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO factures (id, user_id, titre, description, montant, categorie, date_echeance, payee, date_paiement, courant_transaction_id, notif_state, recurrence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      f.id, f.user_id, f.titre, f.description, f.montant, f.categorie,
      f.date_echeance, f.payee ? 1 : 0, f.date_paiement, f.courant_transaction_id,
      f.notif_state ?? 0, f.recurrence
    );
  }
}

export function useFactures(userId: number) {
  const getFactures = useCallback(async (): Promise<Facture[]> => {
    const res = await api.get<Facture[]>('/factures');
    if (res.ok) {
      await cacheFactures(res.data);
      return res.data.map((r) => ({
        ...r,
        payee: Boolean(r.payee),
        notif_state: (r.notif_state ?? 0) as NotifState,
        recurrence: r.recurrence ?? null,
      }));
    }
    const db = await getDb();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM factures WHERE user_id = ? ORDER BY payee ASC, date_echeance ASC`, userId
    );
    return rows.map((r: any) => ({
      ...r,
      payee: Boolean(r.payee),
      notif_state: (r.notif_state ?? 0) as NotifState,
      recurrence: r.recurrence ?? null,
    }));
  }, [userId]);

  const createFacture = useCallback(async (
    titre: string, montant: number, categorie: string,
    description?: string, date_echeance?: string, recurrence?: 'mensuel' | null
  ): Promise<number> => {
    const res = await api.post('/factures', {
      titre, montant, categorie, description, date_echeance, recurrence
    });
    if (!res.ok) throw new Error(res.data.error || 'Erreur création');
    const f = res.data as Facture;
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO factures (id, user_id, titre, description, montant, categorie, date_echeance, recurrence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      f.id, userId, titre, description ?? null, montant, categorie, date_echeance ?? null, recurrence ?? null
    );
    return f.id;
  }, [userId]);

  const updateFacture = useCallback(async (
    id: number, titre: string, montant: number, categorie: string,
    description?: string, date_echeance?: string, recurrence?: 'mensuel' | null
  ): Promise<void> => {
    const res = await api.put(`/factures/${id}`, {
      titre, montant, categorie, description, date_echeance, recurrence
    });
    if (!res.ok) throw new Error(res.data.error || 'Erreur modification');
    const db = await getDb();
    await db.runAsync(
      `UPDATE factures SET titre = ?, montant = ?, categorie = ?, description = ?, date_echeance = ?, recurrence = ?
       WHERE id = ? AND user_id = ? AND payee = 0`,
      titre, montant, categorie, description ?? null, date_echeance ?? null, recurrence ?? null, id, userId
    );
  }, [userId]);

  const deleteFacture = useCallback(async (id: number): Promise<void> => {
    const res = await api.delete(`/factures/${id}`);
    if (!res.ok) throw new Error(res.data.error || 'Erreur suppression');
    const db = await getDb();
    await db.runAsync('DELETE FROM factures WHERE id = ? AND user_id = ?', id, userId);
  }, [userId]);

  const payerFacture = useCallback(async (
    factureId: number, montant: number, titre: string,
    categorie: string, stockage: StockageType
  ): Promise<void> => {
    const res = await api.post(`/factures/${factureId}/payer`, {
      montant, titre, categorie, stockage
    });
    if (!res.ok) throw new Error(res.data.error || 'Erreur paiement');
    const now = new Date().toISOString();
    const db = await getDb();
    const txId = res.data.transaction_id;
    await db.runAsync(
      `INSERT INTO courant_transactions (id, user_id, type, stockage, montant, description, categorie, date, source, facture_id)
       VALUES (?, ?, 'sortie', ?, ?, ?, ?, ?, 'facture', ?)`,
      txId, userId, stockage, montant, `Paiement facture: ${titre}`, categorie, now, factureId
    );
    await db.runAsync(
      `UPDATE factures SET payee = 1, date_paiement = ?, courant_transaction_id = ?
       WHERE id = ? AND user_id = ?`,
      now, txId, factureId, userId
    );
  }, [userId]);

  const autoCreateRecurringBills = useCallback(async (): Promise<void> => {
    const res = await api.post('/factures/recurring/create');
    if (!res.ok) return;
    const db = await getDb();
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM factures
       WHERE user_id = ? AND recurrence = 'mensuel' AND payee = 1 AND date_paiement < ?`,
      userId, firstOfMonth
    );
    for (const row of rows) {
      const echeance = row.date_echeance ? new Date(row.date_echeance) : new Date();
      echeance.setMonth(echeance.getMonth() + 1);
      const newEcheance = echeance.toISOString().slice(0, 10);
      const existing = await db.getFirstAsync<any>(
        `SELECT id FROM factures
         WHERE user_id = ? AND titre = ? AND recurrence = 'mensuel' AND date_echeance = ? AND payee = 0`,
        userId, row.titre, newEcheance
      );
      if (!existing) {
        await db.runAsync(
          `INSERT INTO factures (user_id, titre, montant, categorie, description, date_echeance, recurrence)
           VALUES (?, ?, ?, ?, ?, ?, 'mensuel')`,
          userId, row.titre, row.montant, row.categorie, row.description, newEcheance
        );
      }
    }
  }, [userId]);

  return {
    getFactures, createFacture, updateFacture,
    deleteFacture, payerFacture, autoCreateRecurringBills,
  };
}
