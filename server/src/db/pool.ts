import { Pool } from 'pg';
import { config } from '../config';

export const pool = new Pool({ connectionString: config.databaseUrl });

pool.on('error', (err) => {
  console.error('Unexpected pg pool error:', err);
  process.exit(1);
});

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 100) {
    console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
  }
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
}
