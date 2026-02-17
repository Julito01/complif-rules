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
/**
 * Get or create the database connection pool.
 * Uses lazy initialization to avoid connection errors at import time.
 */
export declare function getPool(): pg.Pool;
/**
 * Execute a read-only query with parameterized values.
 *
 * @param query - SQL query string (must be SELECT or read-only)
 * @param params - Query parameters for safe interpolation
 * @returns Query result rows
 * @throws Error if query appears to be a write operation
 */
export declare function executeReadOnlyQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(query: string, params?: unknown[]): Promise<T[]>;
/**
 * Check if the database connection is healthy.
 */
export declare function checkConnection(): Promise<boolean>;
/**
 * Gracefully close the database pool.
 */
export declare function closePool(): Promise<void>;
//# sourceMappingURL=client.d.ts.map