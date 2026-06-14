import { query } from './pool';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courant_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('entree','sortie')),
  stockage TEXT NOT NULL CHECK(stockage IN ('espece','mobile_money','banque')),
  montant REAL NOT NULL,
  description TEXT,
  categorie TEXT DEFAULT 'Autre',
  date TIMESTAMP DEFAULT NOW(),
  source TEXT DEFAULT 'manuel',
  facture_id INTEGER
);

CREATE TABLE IF NOT EXISTS epargne_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('entree','sortie')),
  montant REAL NOT NULL,
  description TEXT,
  date TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factures (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  description TEXT,
  montant REAL NOT NULL,
  categorie TEXT DEFAULT 'Autre',
  date_echeance TEXT,
  payee BOOLEAN DEFAULT FALSE,
  date_paiement TEXT,
  courant_transaction_id INTEGER,
  notif_state INTEGER DEFAULT 0,
  recurrence TEXT
);

CREATE TABLE IF NOT EXISTS parametres (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cle TEXT NOT NULL,
  valeur TEXT NOT NULL,
  UNIQUE(user_id, cle)
);

CREATE TABLE IF NOT EXISTS regles_budget (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  categorie TEXT NOT NULL,
  montant_max REAL NOT NULL,
  periode TEXT NOT NULL DEFAULT 'mensuel' CHECK(periode IN ('mensuel','hebdomadaire')),
  UNIQUE(user_id, categorie)
);

CREATE TABLE IF NOT EXISTS user_categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'ellipsis-horizontal',
  color TEXT NOT NULL DEFAULT '#636366',
  type TEXT NOT NULL DEFAULT 'both' CHECK(type IN ('entree','sortie','both','facture')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, value)
);
`;

export async function initDatabase(): Promise<void> {
  await query(SCHEMA_SQL);
  console.log('Database schema initialized');
}
