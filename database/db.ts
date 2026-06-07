import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

/** Get or initialize the SQLite database singleton. */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('mon_argent.db');
    await initDatabase(db);
  }
  return db;
}

/** Create all 7 tables if they do not exist, with migration for added columns. */
async function initDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS courant_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('entree','sortie')),
      stockage TEXT NOT NULL CHECK(stockage IN ('espece','mobile_money','banque')),
      montant REAL NOT NULL,
      description TEXT,
      categorie TEXT DEFAULT 'Autre',
      date TEXT DEFAULT (datetime('now')),
      source TEXT DEFAULT 'manuel',
      facture_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS epargne_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('entree','sortie')),
      montant REAL NOT NULL,
      description TEXT,
      date TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS factures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      titre TEXT NOT NULL,
      description TEXT,
      montant REAL NOT NULL,
      categorie TEXT DEFAULT 'Autre',
      date_echeance TEXT,
      payee BOOLEAN DEFAULT 0,
      date_paiement TEXT,
      courant_transaction_id INTEGER,
      notif_state INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS parametres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      cle TEXT NOT NULL,
      valeur TEXT NOT NULL,
      UNIQUE(user_id, cle),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS regles_budget (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      categorie TEXT NOT NULL,
      montant_max REAL NOT NULL,
      periode TEXT NOT NULL DEFAULT 'mensuel' CHECK(periode IN ('mensuel','hebdomadaire')),
      UNIQUE(user_id, categorie),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'ellipsis-horizontal',
      color TEXT NOT NULL DEFAULT '#636366',
      type TEXT NOT NULL DEFAULT 'both' CHECK(type IN ('entree','sortie','both','facture')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, value),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  try {
    await database.execAsync('ALTER TABLE factures ADD COLUMN recurrence TEXT');
  } catch {
  }

  try {
    await database.execAsync('ALTER TABLE factures ADD COLUMN notif_state INTEGER DEFAULT 0');
  } catch {
  }
}

/** Drop all 7 tables and reset the database singleton (dev use only). */
export async function resetDatabase(): Promise<void> {
  if (db) {
    await db.execAsync(`
      DROP TABLE IF EXISTS factures;
      DROP TABLE IF EXISTS epargne_transactions;
      DROP TABLE IF EXISTS courant_transactions;
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS parametres;
      DROP TABLE IF EXISTS regles_budget;
      DROP TABLE IF EXISTS user_categories;
      DROP TABLE IF EXISTS users;
    `);
    db = null;
  }
}
