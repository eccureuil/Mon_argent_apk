import { useCallback } from 'react';
import { getDb } from '../database/db';
import type { Facture, StockageType } from '../types';

export function useFactures(userId: number) {
  const getFactures = useCallback(async (): Promise<Facture[]> => {
    const db = await getDb();
    const rows = await db.getAllAsync<Facture>(
      `SELECT * FROM factures WHERE user_id = ? ORDER BY
       payee ASC, date_echeance ASC`,
      userId
    );
    return rows.map((r) => ({
      ...r,
      payee: Boolean(r.payee),
      notif_sent: Boolean(r.notif_sent),
      recurrence: r.recurrence ?? null,
    }));
  }, [userId]);

  const createFacture = useCallback(
    async (
      titre: string,
      montant: number,
      categorie: string,
      description?: string,
      date_echeance?: string,
      recurrence?: 'mensuel' | null
    ): Promise<number> => {
      const db = await getDb();
      const result = await db.runAsync(
        `INSERT INTO factures (user_id, titre, montant, categorie, description, date_echeance, recurrence)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        userId,
        titre,
        montant,
        categorie,
        description ?? null,
        date_echeance ?? null,
        recurrence ?? null
      );
      return result.lastInsertRowId;
    },
    [userId]
  );

  const updateFacture = useCallback(
    async (
      id: number,
      titre: string,
      montant: number,
      categorie: string,
      description?: string,
      date_echeance?: string,
      recurrence?: 'mensuel' | null
    ): Promise<void> => {
      const db = await getDb();
      await db.runAsync(
        `UPDATE factures SET titre = ?, montant = ?, categorie = ?, description = ?, date_echeance = ?, recurrence = ?
         WHERE id = ? AND user_id = ? AND payee = 0`,
        titre,
        montant,
        categorie,
        description ?? null,
        date_echeance ?? null,
        recurrence ?? null,
        id,
        userId
      );
    },
    [userId]
  );

  const deleteFacture = useCallback(
    async (id: number): Promise<void> => {
      const db = await getDb();
      await db.runAsync(
        'DELETE FROM factures WHERE id = ? AND user_id = ?',
        id,
        userId
      );
    },
    [userId]
  );

  const payerFacture = useCallback(
    async (
      factureId: number,
      montant: number,
      titre: string,
      categorie: string,
      stockage: StockageType
    ): Promise<void> => {
      const db = await getDb();
      const now = new Date().toISOString();

      const result = await db.runAsync(
        `INSERT INTO courant_transactions (user_id, type, stockage, montant, description, categorie, date, source, facture_id)
         VALUES (?, 'sortie', ?, ?, ?, ?, ?, 'facture', ?)`,
        userId,
        stockage,
        montant,
        `Paiement facture: ${titre}`,
        categorie,
        now,
        factureId
      );

      const txId = result.lastInsertRowId;

      await db.runAsync(
        `UPDATE factures SET payee = 1, date_paiement = ?, courant_transaction_id = ?
         WHERE id = ? AND user_id = ?`,
        now,
        txId,
        factureId,
        userId
      );
    },
    [userId]
  );

  const autoCreateRecurringBills = useCallback(async (): Promise<void> => {
    const db = await getDb();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const rows = await db.getAllAsync<any>(
      `SELECT * FROM factures
       WHERE user_id = ? AND recurrence = 'mensuel' AND payee = 1
       AND date_paiement < ?`,
      userId,
      firstOfMonth
    );

    for (const row of rows) {
      const echeance = row.date_echeance
        ? new Date(row.date_echeance)
        : new Date();
      echeance.setMonth(echeance.getMonth() + 1);
      const newEcheance = echeance.toISOString().slice(0, 10);

      const existing = await db.getFirstAsync<any>(
        `SELECT id FROM factures
         WHERE user_id = ? AND titre = ? AND recurrence = 'mensuel'
         AND date_echeance = ? AND payee = 0`,
        userId,
        row.titre,
        newEcheance
      );

      if (!existing) {
        await db.runAsync(
          `INSERT INTO factures (user_id, titre, montant, categorie, description, date_echeance, recurrence)
           VALUES (?, ?, ?, ?, ?, ?, 'mensuel')`,
          userId,
          row.titre,
          row.montant,
          row.categorie,
          row.description,
          newEcheance
        );
      }
    }
  }, [userId]);

  return {
    getFactures,
    createFacture,
    updateFacture,
    deleteFacture,
    payerFacture,
    autoCreateRecurringBills,
  };
}
