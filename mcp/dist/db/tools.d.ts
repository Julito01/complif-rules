/**
 * Database Inspection Tools
 *
 * READ-ONLY tools for inspecting the PostgreSQL database schema and data.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STRICT CONSTRAINTS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * These tools are DIAGNOSTIC ONLY. They must:
 * - Return data without modification
 * - Use parameterized queries to prevent SQL injection
 * - Validate inputs before building queries
 * - Enforce LIMIT on row samples
 *
 * They must NEVER:
 * - Execute write operations
 * - Accept arbitrary WHERE clauses
 * - Return sensitive credentials
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AVAILABLE TOOLS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. inspect_tables    - List tables in a schema
 * 2. describe_table    - Show column definitions
 * 3. count_rows        - Count total rows in a table
 * 4. sample_rows       - Get a small sample of rows
 *
 * @see ./client.ts for database connection
 */
/**
 * List all tables in a schema.
 *
 * @param schema - Schema name (default: 'public')
 * @returns Array of table names
 */
export declare function inspectTables(schema?: string): Promise<{
    schema: string;
    tables: string[];
    count: number;
}>;
/**
 * Describe the structure of a table.
 *
 * @param tableName - Name of the table to describe
 * @param schema - Schema name (default: 'public')
 * @returns Column definitions including name, type, and nullability
 */
export declare function describeTable(tableName: string, schema?: string): Promise<{
    schema: string;
    table: string;
    columns: Array<{
        name: string;
        type: string;
        nullable: boolean;
        defaultValue: string | null;
    }>;
}>;
/**
 * Count the total number of rows in a table.
 *
 * @param tableName - Name of the table
 * @param schema - Schema name (default: 'public')
 * @returns Total row count
 */
export declare function countRows(tableName: string, schema?: string): Promise<{
    schema: string;
    table: string;
    count: number;
}>;
/**
 * Get a sample of rows from a table.
 *
 * @param tableName - Name of the table
 * @param limit - Maximum rows to return (default: 5, max: 100)
 * @param schema - Schema name (default: 'public')
 * @returns Sample rows as key-value objects
 */
export declare function sampleRows(tableName: string, limit?: number, schema?: string): Promise<{
    schema: string;
    table: string;
    limit: number;
    rows: Record<string, unknown>[];
    note: string;
}>;
/**
 * Comprehensive database schema inspection.
 * Returns tables, columns, indexes, and foreign keys in one call.
 * READ-ONLY: uses only information_schema and pg_catalog.
 */
export declare function inspectDatabaseSchema(schema?: string): Promise<{
    schema: string;
    tables: Array<{
        name: string;
        columns: Array<{
            name: string;
            type: string;
            nullable: boolean;
            defaultValue: string | null;
            isPrimaryKey: boolean;
        }>;
        indexes: Array<{
            name: string;
            columns: string[];
            isUnique: boolean;
            isPrimary: boolean;
        }>;
        foreignKeys: Array<{
            constraintName: string;
            column: string;
            referencedTable: string;
            referencedColumn: string;
        }>;
        rowEstimate: number;
    }>;
}>;
/**
 * Query transactions with mandatory filters.
 * READ-ONLY: SELECT only, with enforced LIMIT.
 *
 * Requires at least one of: accountId, organizationId.
 * Time range is recommended but optional.
 */
export declare function queryTransactions(params: {
    organizationId?: string;
    accountId?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    limit?: number;
}): Promise<{
    filters: Record<string, string | number | undefined>;
    rows: Record<string, unknown>[];
    count: number;
    truncated: boolean;
    note: string;
}>;
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
export declare const dbTools: Tool[];
/**
 * Handle database tool calls.
 *
 * @param name - Tool name
 * @param args - Tool arguments
 * @returns JSON string result
 */
export declare function handleDbToolCall(name: string, args: Record<string, unknown>): Promise<string>;
//# sourceMappingURL=tools.d.ts.map