import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('mon_argent.db');
    await initDatabase(db);
  }
  return db;
}

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
      notif_sent BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
}

export async function resetDatabase(): Promise<void> {
  if (db) {
    await db.execAsync(`
      DROP TABLE IF EXISTS factures;
      DROP TABLE IF EXISTS epargne_transactions;
      DROP TABLE IF EXISTS courant_transactions;
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS users;
    `);
    db = null;
  }
}
