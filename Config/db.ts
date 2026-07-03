import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

export type Queryable = Pool | PoolClient;
export default pool;
