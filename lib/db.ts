import { Pool } from 'pg';

// Next.js dev mode reloads modules on every change, which would otherwise
// spawn a fresh Pool (and fresh connections) on every request. Caching it
// on `global` keeps a single pool alive across reloads.
declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

const pool =
  global.pgPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
  });

if (process.env.NODE_ENV !== 'production') {
  global.pgPool = pool;
}

export default pool;
