/**
 * Complif MCP Server
 *
 * An MCP (Model Context Protocol) server that provides Claude with
 * access to the Complif API and PostgreSQL database for development,
 * inspection, testing, and reasoning.
 *
 * This is a TOOL ADAPTER, not a service. It contains:
 * - NO business logic
 * - NO authorization/compliance logic
 * - Read-only, write, and simulation endpoints
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TOOL CATEGORIES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. API Tools — Read (get_signature_*, simulate_*, explain_*)
 *    - Call backend HTTP APIs (GET)
 *    - Respect authorization and business rules
 *    - Use for business entity inspection
 *
 * 2. API Tools — Write (seed_*, ingest_*, create_*, update_*, add_*)
 *    - Call backend HTTP APIs (POST/PUT)
 *    - Create/modify business entities
 *    - Use for testing and data setup
 *
 * 3. Database Tools (inspect_tables, describe_table, count_rows, sample_rows)
 *    - Direct PostgreSQL inspection
 *    - Strictly READ-ONLY (no INSERT/UPDATE/DELETE/DDL)
 *    - Use for schema exploration and debugging
 *
 * 4. Explanation Tools (explain_*)
 *    - Pure computation, no side effects
 *    - Use for reasoning about rules and evaluations
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHEN TO USE WHICH
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Prefer API tools when:
 * - Fetching business entities (rules, requests, signatures)
 * - Authorization matters
 * - Side effects might be triggered
 *
 * Prefer DB tools when:
 * - Exploring schema structure
 * - Debugging data issues
 * - Checking data existence or counts
 * - Understanding table relationships
 *
 * @see https://modelcontextprotocol.io/
 */
export {};
//# sourceMappingURL=index.d.ts.map