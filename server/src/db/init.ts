import { query } from './pool';
import fs from 'fs';
import path from 'path';

export async function initDatabase(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await query(sql);
  console.log('Database schema initialized');
}
