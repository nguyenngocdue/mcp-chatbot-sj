import { jsonHeaders } from '@/app/globals';
import { pgDb } from 'lib/db/pg/db.pg';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET() {
  let dbOk = false;
  let dbError = null;

  try {
    // Use drizzle-orm: run a simple query to check DB connection
    await pgDb.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (err) {
    dbError = (err instanceof Error && err.message) ? err.message : 'DB error';
  }

  const status = dbOk ? 'ok' : 'error';
  const result = {
    status,
    db: dbOk ? 'ok' : dbError,
    timestamp: Date.now(),
  };

  return new Response(JSON.stringify(result), {
    status: dbOk ? 200 : 500,
    headers: jsonHeaders(),
  });
}

export { OPTIONS } from '@/app/globals';
