export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export type StockageType = 'espece' | 'mobile_money' | 'banque';
export type TransactionType = 'entree' | 'sortie';
export type TransactionSource = 'manuel' | 'facture';

export interface CourantTransaction {
  id: number;
  user_id: number;
  type: TransactionType;
  stockage: StockageType;
  montant: number;
  description: string | null;
  categorie: string;
  date: string;
  source: TransactionSource;
  facture_id: number | null;
}

export interface EpargneTransaction {
  id: number;
  user_id: number;
  type: TransactionType;
  montant: number;
  description: string | null;
  date: string;
}

export type NotifState = 0 | 1 | 2;

export interface Facture {
  id: number;
  user_id: number;
  titre: string;
  description: string | null;
  montant: number;
  categorie: string;
  date_echeance: string | null;
  payee: boolean;
  date_paiement: string | null;
  courant_transaction_id: number | null;
  notif_state: NotifState;
  recurrence: 'mensuel' | null;
}

export interface SoldeByStockage {
  espece: number;
  mobile_money: number;
  banque: number;
  total: number;
}

export interface MonthlySummary {
  total_entrees: number;
  total_sorties: number;
  solde_net: number;
}

export interface WeeklyBreakdown {
  week: number;
  entrees: number;
  sorties: number;
}

export interface CategorieBreakdown {
  categorie: string;
  montant: number;
  percentage: number;
  color: string;
}

export interface EpargneEvolution {
  date: string;
  solde: number;
}

export interface RegleBudget {
  id: number;
  user_id: number;
  categorie: string;
  montant_max: number;
  periode: 'mensuel' | 'hebdomadaire';
}

export interface UserCategory {
  id: number;
  user_id: number;
  value: string;
  label: string;
  icon: string;
  color: string;
  type: 'entree' | 'sortie' | 'both' | 'facture';
  sort_order: number;
}
