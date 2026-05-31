import { useState, useCallback } from 'react';
import { getDb } from '../database/db';
import type { Facture, StockageType } from '../types';

export function useFactures(userId: number) {
  const [loading, setLoading] = useState(false);

  const getFactures = useCallback(async (): Promise<Facture[]> => {
    const db = await getDb();
    const rows = await db.getAllAsync<Facture>(
      `SELECT * FROM factures WHERE user_id = ? ORDER BY
       payee ASC, date_echeance ASC`,
      userId
    );
    return rows.map((r) => ({ ...r, payee: Boolean(r.payee), notif_sent: Boolean(r.notif_sent) }));
  }, [userId]);

  const createFacture = useCallback(
    async (
      titre: string,
      montant: number,
      categorie: string,
      description?: string,
      date_echeance?: string
    ): Promise<number> => {
      const db = await getDb();
      const result = await db.runAsync(
        `INSERT INTO factures (user_id, titre, montant, categorie, description, date_echeance)
         VALUES (?, ?, ?, ?, ?, ?)`,
        userId,
        titre,
        montant,
        categorie,
        description ?? null,
        date_echeance ?? null
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
      date_echeance?: string
    ): Promise<void> => {
      const db = await getDb();
      await db.runAsync(
        `UPDATE factures SET titre = ?, montant = ?, categorie = ?, description = ?, date_echeance = ?
         WHERE id = ? AND user_id = ? AND payee = 0`,
        titre,
        montant,
        categorie,
        description ?? null,
        date_echeance ?? null,
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

  return {
    loading,
    setLoading,
    getFactures,
    createFacture,
    updateFacture,
    deleteFacture,
    payerFacture,
  };
}
