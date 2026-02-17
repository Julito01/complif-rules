/**
 * Database Tools Module
 *
 * Exports read-only database inspection tools for the MCP server.
 */
export { getPool, executeReadOnlyQuery, checkConnection, closePool } from './client.js';
export { dbTools, handleDbToolCall, inspectTables, describeTable, countRows, sampleRows, inspectDatabaseSchema, queryTransactions, } from './tools.js';
//# sourceMappingURL=index.d.ts.map