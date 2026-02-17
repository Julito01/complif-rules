/**
 * Database Client Module
 *
 * Provides a READ-ONLY PostgreSQL connection for database inspection.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IMPORTANT: READ-ONLY CONSTRAINT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This module is designed for INSPECTION ONLY. It must NEVER:
 * - Execute INSERT, UPDATE, DELETE, or DDL statements
 * - Modify schema or data
 * - Bypass API for write operations
 *
 * The database tools exist to help Claude understand the current state of the
 * database during development and debugging. All mutations MUST go through
 * the API layer where business rules and authorization are enforced.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHEN TO USE DB TOOLS vs API TOOLS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Use DB tools when:
 * - Exploring schema structure (tables, columns, types)
 * - Checking data existence or counts
 * - Debugging data issues
 * - Understanding relationships between entities
 *
 * Use API tools when:
 * - Fetching business entities (signature rules, requests, etc.)
 * - Any operation that should respect authorization
 * - Any operation that might trigger side effects
 *
 * @see https://node-postgres.com/
 */

import pg from 'pg';

const { Pool } = pg;

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DATABASE_URI =
  process.env.DATABASE_URI || 'postgresql://complif:complif@localhost:5432/complif';

// ─────────────────────────────────────────────────────────────────────────────
// Connection Pool
// ─────────────────────────────────────────────────────────────────────────────

let pool: pg.Pool | null = null;

/**
 * Get or create the database connection pool.
 * Uses lazy initialization to avoid connection errors at import time.
 */
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URI,
      max: 3, // Small pool since this is for inspection only
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Log connection errors but don't crash
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err.message);
    });
  }
  return pool;
}

/**
 * Execute a read-only query with parameterized values.
 *
 * @param query - SQL query string (must be SELECT or read-only)
 * @param params - Query parameters for safe interpolation
 * @returns Query result rows
 * @throws Error if query appears to be a write operation
 */
export async function executeReadOnlyQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  query: string,
  params: unknown[] = [],
): Promise<T[]> {
  // Safety check: reject obviously dangerous queries
  const normalized = query.trim().toUpperCase();
  const writeOperations = [
    'INSERT',
    'UPDATE',
    'DELETE',
    'DROP',
    'CREATE',
    'ALTER',
    'TRUNCATE',
    'GRANT',
    'REVOKE',
  ];

  for (const op of writeOperations) {
    if (normalized.startsWith(op)) {
      throw new Error(`Write operation "${op}" is not allowed. This MCP is read-only.`);
    }
  }

  const db = getPool();
  const result = await db.query<T>(query, params);
  return result.rows;
}

/**
 * Check if the database connection is healthy.
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const db = getPool();
    await db.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Gracefully close the database pool.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
