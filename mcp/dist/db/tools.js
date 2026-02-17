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
import { executeReadOnlyQuery } from './client.js';
// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Validate that an identifier (table/schema name) is safe.
 * Prevents SQL injection by rejecting suspicious characters.
 */
function validateIdentifier(name, type) {
    if (!name || typeof name !== 'string') {
        throw new Error(`${type} name is required`);
    }
    // PostgreSQL identifiers: letters, digits, underscores, max 63 chars
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
    if (!validPattern.test(name)) {
        throw new Error(`Invalid ${type} name: "${name}". Must start with a letter or underscore, contain only alphanumeric characters and underscores, and be at most 63 characters.`);
    }
}
/**
 * Sanitize and validate limit value.
 */
function validateLimit(limit) {
    const MAX_LIMIT = 100; // Hard cap for safety
    const DEFAULT_LIMIT = 5;
    if (limit === undefined || limit === null) {
        return DEFAULT_LIMIT;
    }
    const parsed = typeof limit === 'number' ? limit : parseInt(String(limit), 10);
    if (isNaN(parsed) || parsed < 1) {
        return DEFAULT_LIMIT;
    }
    return Math.min(parsed, MAX_LIMIT);
}
// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// ─────────────────────────────────────────────────────────────────────────────
/**
 * List all tables in a schema.
 *
 * @param schema - Schema name (default: 'public')
 * @returns Array of table names
 */
export async function inspectTables(schema = 'public') {
    validateIdentifier(schema, 'schema');
    const rows = await executeReadOnlyQuery(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
    `, [schema]);
    const tables = rows.map((r) => r.table_name);
    return {
        schema,
        tables,
        count: tables.length,
    };
}
/**
 * Describe the structure of a table.
 *
 * @param tableName - Name of the table to describe
 * @param schema - Schema name (default: 'public')
 * @returns Column definitions including name, type, and nullability
 */
export async function describeTable(tableName, schema = 'public') {
    validateIdentifier(tableName, 'table');
    validateIdentifier(schema, 'schema');
    const rows = await executeReadOnlyQuery(`
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    ORDER BY ordinal_position
    `, [schema, tableName]);
    if (rows.length === 0) {
        throw new Error(`Table "${schema}.${tableName}" not found or has no columns`);
    }
    return {
        schema,
        table: tableName,
        columns: rows.map((r) => ({
            name: r.column_name,
            type: r.data_type,
            nullable: r.is_nullable === 'YES',
            defaultValue: r.column_default,
        })),
    };
}
/**
 * Count the total number of rows in a table.
 *
 * @param tableName - Name of the table
 * @param schema - Schema name (default: 'public')
 * @returns Total row count
 */
export async function countRows(tableName, schema = 'public') {
    validateIdentifier(tableName, 'table');
    validateIdentifier(schema, 'schema');
    // Use double quotes for identifiers to handle case-sensitivity
    // Parameters can't be used for identifiers, so we validate strictly above
    const query = `SELECT COUNT(*) as count FROM "${schema}"."${tableName}"`;
    const rows = await executeReadOnlyQuery(query);
    return {
        schema,
        table: tableName,
        count: parseInt(rows[0]?.count || '0', 10),
    };
}
/**
 * Get a sample of rows from a table.
 *
 * @param tableName - Name of the table
 * @param limit - Maximum rows to return (default: 5, max: 100)
 * @param schema - Schema name (default: 'public')
 * @returns Sample rows as key-value objects
 */
export async function sampleRows(tableName, limit = 5, schema = 'public') {
    validateIdentifier(tableName, 'table');
    validateIdentifier(schema, 'schema');
    const safeLimit = validateLimit(limit);
    // Use TABLESAMPLE for large tables, but fallback to LIMIT for simplicity
    // The identifier is validated above, so safe to interpolate
    const query = `SELECT * FROM "${schema}"."${tableName}" LIMIT ${safeLimit}`;
    const rows = await executeReadOnlyQuery(query);
    return {
        schema,
        table: tableName,
        limit: safeLimit,
        rows,
        note: 'This is a random sample. No ordering is applied.',
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Advanced Inspection Tools (Part 1 support)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Comprehensive database schema inspection.
 * Returns tables, columns, indexes, and foreign keys in one call.
 * READ-ONLY: uses only information_schema and pg_catalog.
 */
export async function inspectDatabaseSchema(schema = 'public') {
    validateIdentifier(schema, 'schema');
    // 1. Tables
    const tables = await executeReadOnlyQuery(`SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'
     ORDER BY table_name`, [schema]);
    // 2. Columns for all tables
    const columns = await executeReadOnlyQuery(`SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = $1
     ORDER BY table_name, ordinal_position`, [schema]);
    // 3. Indexes
    const indexes = await executeReadOnlyQuery(`SELECT tablename, indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = $1
     ORDER BY tablename, indexname`, [schema]);
    // 4. Primary keys
    const primaryKeys = await executeReadOnlyQuery(`SELECT kcu.table_name, kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'PRIMARY KEY'
       AND tc.table_schema = $1`, [schema]);
    // 5. Foreign keys
    const foreignKeys = await executeReadOnlyQuery(`SELECT
       kcu.table_name,
       kcu.constraint_name,
       kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = $1`, [schema]);
    // 6. Row estimates (fast, from pg_stat)
    const rowEstimates = await executeReadOnlyQuery(`SELECT relname, n_live_tup
     FROM pg_stat_user_tables
     WHERE schemaname = $1`, [schema]);
    // Build lookup maps
    const pkSet = new Set(primaryKeys.map((pk) => `${pk.table_name}.${pk.column_name}`));
    const estimateMap = new Map(rowEstimates.map((r) => [r.relname, parseInt(r.n_live_tup, 10)]));
    return {
        schema,
        tables: tables.map((t) => {
            const tblCols = columns.filter((c) => c.table_name === t.table_name);
            const tblIdx = indexes.filter((i) => i.tablename === t.table_name);
            const tblFk = foreignKeys.filter((fk) => fk.table_name === t.table_name);
            return {
                name: t.table_name,
                columns: tblCols.map((c) => ({
                    name: c.column_name,
                    type: c.data_type,
                    nullable: c.is_nullable === 'YES',
                    defaultValue: c.column_default,
                    isPrimaryKey: pkSet.has(`${t.table_name}.${c.column_name}`),
                })),
                indexes: tblIdx.map((i) => {
                    // Parse column names from indexdef
                    const colMatch = i.indexdef.match(/\(([^)]+)\)/);
                    const idxCols = colMatch ? colMatch[1].split(',').map((s) => s.trim()) : [];
                    return {
                        name: i.indexname,
                        columns: idxCols,
                        isUnique: i.indexdef.toUpperCase().includes('UNIQUE'),
                        isPrimary: i.indexname.endsWith('_pkey'),
                    };
                }),
                foreignKeys: tblFk.map((fk) => ({
                    constraintName: fk.constraint_name,
                    column: fk.column_name,
                    referencedTable: fk.foreign_table_name,
                    referencedColumn: fk.foreign_column_name,
                })),
                rowEstimate: estimateMap.get(t.table_name) || 0,
            };
        }),
    };
}
/**
 * Query transactions with mandatory filters.
 * READ-ONLY: SELECT only, with enforced LIMIT.
 *
 * Requires at least one of: accountId, organizationId.
 * Time range is recommended but optional.
 */
export async function queryTransactions(params) {
    const MAX_ROWS = 100;
    const DEFAULT_ROWS = 20;
    if (!params.organizationId && !params.accountId) {
        throw new Error('At least one filter is required: organizationId or accountId. ' +
            'Unscoped queries are not allowed for safety.');
    }
    const safeLimit = Math.min(Math.max(1, params.limit || DEFAULT_ROWS), MAX_ROWS);
    const conditions = [];
    const values = [];
    let paramIndex = 1;
    if (params.organizationId) {
        conditions.push(`organization_id = $${paramIndex++}`);
        values.push(params.organizationId);
    }
    if (params.accountId) {
        conditions.push(`account_id = $${paramIndex++}`);
        values.push(params.accountId);
    }
    if (params.startDate) {
        conditions.push(`datetime >= $${paramIndex++}`);
        values.push(params.startDate);
    }
    if (params.endDate) {
        conditions.push(`datetime <= $${paramIndex++}`);
        values.push(params.endDate);
    }
    if (params.type) {
        conditions.push(`type = $${paramIndex++}`);
        values.push(params.type);
    }
    // Check if the transaction table exists before querying
    const tableCheck = await executeReadOnlyQuery(`SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'transaction'
     ) as exists`);
    if (!tableCheck[0]?.exists) {
        return {
            filters: { ...params, limit: safeLimit },
            rows: [],
            count: 0,
            truncated: false,
            note: 'Transaction table does not exist yet. Part 1 may not be implemented.',
        };
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM "public"."transaction" ${whereClause} ORDER BY datetime DESC LIMIT ${safeLimit + 1}`;
    const rows = await executeReadOnlyQuery(query, values);
    const truncated = rows.length > safeLimit;
    const resultRows = truncated ? rows.slice(0, safeLimit) : rows;
    return {
        filters: { ...params, limit: safeLimit },
        rows: resultRows,
        count: resultRows.length,
        truncated,
        note: truncated
            ? `Results truncated to ${safeLimit} rows. More data exists.`
            : `Returned ${resultRows.length} rows.`,
    };
}
export const dbTools = [
    {
        name: 'inspect_database_schema',
        description: `Returns a comprehensive view of the database schema including tables, columns, indexes, foreign keys, and row estimates.
This is a READ-ONLY operation using only information_schema and pg_catalog.

Use this tool to:
- Get a full picture of the database structure in one call
- Understand table relationships and foreign keys
- Check indexing strategies for query optimization
- Verify schema matches expected entity definitions`,
        inputSchema: {
            type: 'object',
            properties: {
                schema: {
                    type: 'string',
                    description: 'Schema name (default: public)',
                    default: 'public',
                },
            },
            required: [],
        },
    },
    {
        name: 'query_transactions',
        description: `Read-only query of the transaction table with mandatory scoping filters.
Requires at least one of: organizationId, accountId.
Returns up to 100 rows (default: 20).
This is a READ-ONLY operation.

Use this tool to:
- Inspect transaction data for debugging rule evaluation
- Verify sliding window data ranges
- Check transaction types and amounts
- Debug aggregation correctness

Constraints:
- LIMIT is always enforced (max 100)
- At least one scope filter is required
- Results ordered by datetime DESC
- Returns gracefully if transaction table doesn't exist yet`,
        inputSchema: {
            type: 'object',
            properties: {
                organizationId: {
                    type: 'string',
                    description: 'Organization ID to scope the query',
                },
                accountId: {
                    type: 'string',
                    description: 'Account ID to scope the query',
                },
                startDate: {
                    type: 'string',
                    description: 'ISO 8601 start datetime filter (inclusive)',
                },
                endDate: {
                    type: 'string',
                    description: 'ISO 8601 end datetime filter (inclusive)',
                },
                type: {
                    type: 'string',
                    description: 'Transaction type filter (e.g., CASH_IN, CASH_OUT, DEBIT, CREDIT)',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum rows to return (default: 20, max: 100)',
                    default: 20,
                },
            },
            required: [],
        },
    },
    {
        name: 'inspect_tables',
        description: `Lists all tables in a database schema.
Returns table names only (no data).
This is a READ-ONLY operation.

Use this tool to:
- Discover what tables exist in the database
- Understand the database structure
- Find tables related to a feature

Prefer API tools over this when:
- You need business entities with authorization`,
        inputSchema: {
            type: 'object',
            properties: {
                schema: {
                    type: 'string',
                    description: 'Schema name (default: public)',
                    default: 'public',
                },
            },
            required: [],
        },
    },
    {
        name: 'describe_table',
        description: `Shows the column definitions of a table.
Returns column names, data types, nullability, and defaults.
This is a READ-ONLY operation using information_schema only.

Use this tool to:
- Understand table structure before querying
- Check column types for debugging
- Verify schema matches entity definitions`,
        inputSchema: {
            type: 'object',
            properties: {
                tableName: {
                    type: 'string',
                    description: 'Name of the table to describe',
                },
                schema: {
                    type: 'string',
                    description: 'Schema name (default: public)',
                    default: 'public',
                },
            },
            required: ['tableName'],
        },
    },
    {
        name: 'count_rows',
        description: `Counts the total number of rows in a table.
Returns a single count value.
This is a READ-ONLY operation.

Use this tool to:
- Check if a table has data
- Verify data was seeded
- Get a quick overview of table size`,
        inputSchema: {
            type: 'object',
            properties: {
                tableName: {
                    type: 'string',
                    description: 'Name of the table to count',
                },
                schema: {
                    type: 'string',
                    description: 'Schema name (default: public)',
                    default: 'public',
                },
            },
            required: ['tableName'],
        },
    },
    {
        name: 'sample_rows',
        description: `Returns a small sample of rows from a table.
Returns up to 100 rows (default: 5).
This is a READ-ONLY operation.

Use this tool to:
- See example data in a table
- Understand data format and content
- Debug data issues

Constraints:
- LIMIT is always enforced (max 100)
- No WHERE clauses can be specified
- No ordering is applied`,
        inputSchema: {
            type: 'object',
            properties: {
                tableName: {
                    type: 'string',
                    description: 'Name of the table to sample',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum rows to return (default: 5, max: 100)',
                    default: 5,
                },
                schema: {
                    type: 'string',
                    description: 'Schema name (default: public)',
                    default: 'public',
                },
            },
            required: ['tableName'],
        },
    },
];
// ─────────────────────────────────────────────────────────────────────────────
// Tool Handler
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Handle database tool calls.
 *
 * @param name - Tool name
 * @param args - Tool arguments
 * @returns JSON string result
 */
export async function handleDbToolCall(name, args) {
    try {
        switch (name) {
            case 'inspect_database_schema': {
                const schema = args.schema || 'public';
                const result = await inspectDatabaseSchema(schema);
                return JSON.stringify(result, null, 2);
            }
            case 'query_transactions': {
                const result = await queryTransactions({
                    organizationId: args.organizationId,
                    accountId: args.accountId,
                    startDate: args.startDate,
                    endDate: args.endDate,
                    type: args.type,
                    limit: args.limit,
                });
                return JSON.stringify(result, null, 2);
            }
            case 'inspect_tables': {
                const schema = args.schema || 'public';
                const result = await inspectTables(schema);
                return JSON.stringify(result, null, 2);
            }
            case 'describe_table': {
                const tableName = args.tableName;
                const schema = args.schema || 'public';
                const result = await describeTable(tableName, schema);
                return JSON.stringify(result, null, 2);
            }
            case 'count_rows': {
                const tableName = args.tableName;
                const schema = args.schema || 'public';
                const result = await countRows(tableName, schema);
                return JSON.stringify(result, null, 2);
            }
            case 'sample_rows': {
                const tableName = args.tableName;
                const limit = args.limit;
                const schema = args.schema || 'public';
                const result = await sampleRows(tableName, limit, schema);
                return JSON.stringify(result, null, 2);
            }
            default:
                return JSON.stringify({ error: `Unknown database tool: ${name}` });
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({ error: message });
    }
}
//# sourceMappingURL=tools.js.map