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
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { dbTools, handleDbToolCall, checkConnection } from './db/index.js';
import { explanationTools, handleExplanationToolCall } from './explanation/index.js';
// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const DEFAULT_ORG_ID = process.env.DEFAULT_ORG_ID || 'org-001';
const DATABASE_URI = process.env.DATABASE_URI || 'postgresql://complif:complif@localhost:5432/complif';
async function httpGet(path, organizationId = DEFAULT_ORG_ID) {
    const url = `${API_BASE_URL}${path}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-organization-id': organizationId,
            },
        });
        const data = await response.json();
        return {
            ok: response.ok,
            status: response.status,
            data: data,
        };
    }
    catch (error) {
        return {
            ok: false,
            status: 0,
            data: {
                error: error instanceof Error ? error.message : 'Unknown error',
                url,
            },
        };
    }
}
async function httpPost(path, body, organizationId = DEFAULT_ORG_ID) {
    const url = `${API_BASE_URL}${path}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-organization-id': organizationId,
            },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        return {
            ok: response.ok,
            status: response.status,
            data: data,
        };
    }
    catch (error) {
        return {
            ok: false,
            status: 0,
            data: {
                error: error instanceof Error ? error.message : 'Unknown error',
                url,
            },
        };
    }
}
async function httpPut(path, body = {}, organizationId = DEFAULT_ORG_ID) {
    const url = `${API_BASE_URL}${path}`;
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-organization-id': organizationId,
            },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        return {
            ok: response.ok,
            status: response.status,
            data: data,
        };
    }
    catch (error) {
        return {
            ok: false,
            status: 0,
            data: {
                error: error instanceof Error ? error.message : 'Unknown error',
                url,
            },
        };
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// API Tool Definitions (READ-ONLY)
// These tools call the backend HTTP API for business entity operations.
// ─────────────────────────────────────────────────────────────────────────────
const apiTools = [
    {
        name: 'check_api_health',
        description: `Checks the health status of the Complif API.
Returns the API health status and any diagnostic information.
This is a READ-ONLY operation useful for verifying the API is running.`,
        inputSchema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'get_signature_schema',
        description: `Retrieves the signature schema and its rules for a given schema ID.
Returns the schema configuration including all associated rules and signer groups.
This is a READ-ONLY operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                schemaId: {
                    type: 'string',
                    description: 'The UUID of the signature schema to retrieve',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['schemaId'],
        },
    },
    {
        name: 'get_signature_rules',
        description: `Retrieves all signature rules for a schema, optionally filtered by faculty.
Returns the rule definitions including AND/OR combinatory logic.
This is a READ-ONLY operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                schemaId: {
                    type: 'string',
                    description: 'The UUID of the signature schema',
                },
                facultyId: {
                    type: 'string',
                    description: 'Optional faculty ID to filter rules',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['schemaId'],
        },
    },
    {
        name: 'get_rule_combinations',
        description: `Returns all possible valid signature combinations for a rule.
Useful for understanding what signatures are required to satisfy a rule.
This is a READ-ONLY operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                ruleId: {
                    type: 'string',
                    description: 'The UUID of the signature rule',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['ruleId'],
        },
    },
    {
        name: 'get_signature_request_status',
        description: `Retrieves the current status of a signature request.
Returns the request details, collected signatures, and remaining requirements.
This is a READ-ONLY operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                requestId: {
                    type: 'string',
                    description: 'The UUID of the signature request',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['requestId'],
        },
    },
    {
        name: 'simulate_signature_evaluation',
        description: `Simulates evaluating a rule with hypothetical signatures.
Does NOT create or persist anything. Pure computation.

NOTE: This tool currently stubs the simulation logic locally since
the API does not expose a simulation endpoint. A proper implementation
would require adding a /signature-rules/:id/simulate endpoint to the API.`,
        inputSchema: {
            type: 'object',
            properties: {
                ruleId: {
                    type: 'string',
                    description: 'The UUID of the signature rule to evaluate',
                },
                signatures: {
                    type: 'object',
                    description: 'Map of group codes to signature counts, e.g., {"A": 1, "B": 2}',
                    additionalProperties: {
                        type: 'number',
                    },
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['ruleId', 'signatures'],
        },
    },
    {
        name: 'explain_authorization_decision',
        description: `Explains whether a set of signatures would satisfy a rule.
Returns a structured explanation with:
- Whether the rule is satisfied
- Which conditions are met/unmet
- What additional signatures would be needed

NOTE: This is a client-side explanation based on fetched rule data.
The API would need an /explain endpoint for server-side analysis.`,
        inputSchema: {
            type: 'object',
            properties: {
                ruleId: {
                    type: 'string',
                    description: 'The UUID of the signature rule',
                },
                signatures: {
                    type: 'object',
                    description: 'Map of group codes to signature counts, e.g., {"A": 1, "B": 2}',
                    additionalProperties: {
                        type: 'number',
                    },
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['ruleId', 'signatures'],
        },
    },
];
// ─────────────────────────────────────────────────────────────────────────────
// API Tool Definitions (WRITE)
// These tools call the backend HTTP API for create/update operations.
// ─────────────────────────────────────────────────────────────────────────────
const writeApiTools = [
    {
        name: 'seed_database',
        description: `Seeds the database with deterministic sample data for both Part 0 (Signatures) and Part 1 (Compliance).
This is idempotent — safe to call multiple times.
Creates: accounts, signers, schemas, faculties, signer groups, signature rules, rule templates, rule versions.
Returns the IDs of all created entities.`,
        inputSchema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'ingest_transaction',
        description: `Ingests a new transaction and evaluates it against all active compliance rules.
Returns the transaction, evaluation result (decision + triggered rules), and any generated alerts.

This is a WRITE operation that:
1. Persists the transaction
2. Loads active rule versions
3. Builds aggregation facts (sliding windows)
4. Evaluates all rules
5. Persists evaluation result
6. Generates alerts for triggered rules`,
        inputSchema: {
            type: 'object',
            properties: {
                idAccount: {
                    type: 'string',
                    description: 'UUID of the account originating the transaction',
                },
                type: {
                    type: 'string',
                    description: 'Transaction type (e.g., CASH_IN, CASH_OUT, DEBIT, CREDIT, TRANSFER)',
                },
                amount: {
                    type: 'number',
                    description: 'Transaction amount (must be >= 0)',
                },
                currency: {
                    type: 'string',
                    description: 'ISO 4217 currency code (3 chars, e.g., "USD", "BRL")',
                },
                datetime: {
                    type: 'string',
                    description: 'ISO 8601 datetime of the transaction (e.g., "2024-01-15T10:30:00Z")',
                },
                amountNormalized: {
                    type: 'number',
                    description: 'Optional normalized amount in a base currency',
                },
                currencyNormalized: {
                    type: 'string',
                    description: 'Optional normalized currency code (3 chars)',
                },
                country: {
                    type: 'string',
                    description: 'Optional country code or name',
                },
                counterpartyId: {
                    type: 'string',
                    description: 'Optional counterparty identifier',
                },
                channel: {
                    type: 'string',
                    description: 'Optional transaction channel (e.g., "WEB", "MOBILE", "ATM")',
                },
                metadata: {
                    type: 'object',
                    description: 'Optional additional metadata as key-value pairs',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['idAccount', 'type', 'amount', 'currency', 'datetime'],
        },
    },
    {
        name: 'create_rule_template',
        description: `Creates a new compliance rule template.
A template defines the metadata for a rule (code, name, category).
Versions are attached to templates to define the actual rule logic.

This is a WRITE operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                code: {
                    type: 'string',
                    description: 'Unique code for the rule template (e.g., "HIGH_AMOUNT", "VELOCITY_CHECK")',
                },
                name: {
                    type: 'string',
                    description: 'Human-readable name',
                },
                description: {
                    type: 'string',
                    description: 'Optional detailed description',
                },
                category: {
                    type: 'string',
                    description: 'Optional category (e.g., "AML", "FRAUD")',
                },
                isActive: {
                    type: 'boolean',
                    description: 'Whether the template is active (default: true)',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['code', 'name'],
        },
    },
    {
        name: 'create_rule_version',
        description: `Creates a new immutable version for a rule template.
Automatically deactivates the previous active version for the same template.

The conditions field uses a recursive tree structure:
- Comparison: { "field": "amount", "operator": ">", "value": 10000 }
- AND: { "all": [ ...conditions ] }
- OR: { "any": [ ...conditions ] }
- Operators: =, !=, >, >=, <, <=, in, not_in, contains, not_contains, between, regex

The actions field defines what happens when the rule triggers:
- { "type": "ALERT", "severity": "HIGH", "category": "AML", "message": "..." }

The window field defines a sliding time window for aggregations:
- { "duration": 24, "unit": "hours" }

This is a WRITE operation. Rule versions are immutable once created.`,
        inputSchema: {
            type: 'object',
            properties: {
                templateId: {
                    type: 'string',
                    description: 'UUID of the parent rule template',
                },
                conditions: {
                    type: 'object',
                    description: 'Rule conditions as a recursive tree (see description for format)',
                },
                actions: {
                    type: 'array',
                    description: 'Actions to execute when rule triggers',
                    items: {
                        type: 'object',
                    },
                },
                window: {
                    type: 'object',
                    description: 'Optional sliding window spec: { duration: number, unit: "hours"|"days"|"minutes" }',
                },
                priority: {
                    type: 'number',
                    description: 'Rule priority (higher = evaluated first, default: 0)',
                },
                enabled: {
                    type: 'boolean',
                    description: 'Whether the version is enabled (default: true)',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['templateId', 'conditions', 'actions'],
        },
    },
    {
        name: 'list_rule_templates',
        description: `Lists all compliance rule templates for the organization.
Returns template metadata (code, name, category, isActive).
This is a READ-ONLY operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: [],
        },
    },
    {
        name: 'get_rule_template',
        description: `Retrieves a specific rule template by ID.
Returns the template with its metadata.
This is a READ-ONLY operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                templateId: {
                    type: 'string',
                    description: 'UUID of the rule template',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['templateId'],
        },
    },
    {
        name: 'list_active_rule_versions',
        description: `Lists all active (non-deactivated) rule versions for the organization.
Returns version details including conditions, actions, window, and priority.
This is a READ-ONLY operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: [],
        },
    },
    {
        name: 'list_rule_versions',
        description: `Lists all versions for a specific rule template.
Returns all versions (active and deactivated) ordered by version number.
This is a READ-ONLY operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                templateId: {
                    type: 'string',
                    description: 'UUID of the rule template',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['templateId'],
        },
    },
    {
        name: 'deactivate_rule_version',
        description: `Deactivates a specific rule version.
Deactivated versions are no longer used during transaction evaluation.
This is a WRITE operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                versionId: {
                    type: 'string',
                    description: 'UUID of the rule version to deactivate',
                },
                deactivatedAt: {
                    type: 'string',
                    description: 'Optional ISO 8601 datetime for deactivation (defaults to now)',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['versionId'],
        },
    },
    {
        name: 'list_alerts',
        description: `Lists compliance alerts with optional filters.
Returns alert details including severity, category, status, and related transaction.
This is a READ-ONLY operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                idAccount: {
                    type: 'string',
                    description: 'Optional account ID filter',
                },
                status: {
                    type: 'string',
                    description: 'Optional status filter (e.g., "OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED")',
                },
                severity: {
                    type: 'string',
                    description: 'Optional severity filter (e.g., "LOW", "MEDIUM", "HIGH", "CRITICAL")',
                },
                category: {
                    type: 'string',
                    description: 'Optional category filter (e.g., "AML", "FRAUD")',
                },
                limit: {
                    type: 'number',
                    description: 'Optional max results (default: 50)',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: [],
        },
    },
    {
        name: 'update_alert_status',
        description: `Updates the status of a compliance alert.
Valid statuses: OPEN, ACKNOWLEDGED, RESOLVED, DISMISSED.
This is a WRITE operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                alertId: {
                    type: 'string',
                    description: 'UUID of the alert to update',
                },
                status: {
                    type: 'string',
                    description: 'New status (OPEN, ACKNOWLEDGED, RESOLVED, DISMISSED)',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['alertId', 'status'],
        },
    },
    {
        name: 'list_transactions',
        description: `Lists transactions with optional filters.
Returns transaction data ordered by datetime DESC.
This is a READ-ONLY operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                idAccount: {
                    type: 'string',
                    description: 'Optional account ID filter',
                },
                type: {
                    type: 'string',
                    description: 'Optional transaction type filter',
                },
                startDate: {
                    type: 'string',
                    description: 'Optional ISO 8601 start datetime filter',
                },
                endDate: {
                    type: 'string',
                    description: 'Optional ISO 8601 end datetime filter',
                },
                limit: {
                    type: 'number',
                    description: 'Optional max results',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: [],
        },
    },
    {
        name: 'list_evaluation_results',
        description: `Lists transaction evaluation results with optional filters.
Returns evaluation details including decision, triggered rules, and duration.
This is a READ-ONLY operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                idTransaction: {
                    type: 'string',
                    description: 'Optional transaction ID filter',
                },
                idAccount: {
                    type: 'string',
                    description: 'Optional account ID filter',
                },
                decision: {
                    type: 'string',
                    description: 'Optional decision filter (ALLOW, REVIEW, BLOCK)',
                },
                limit: {
                    type: 'number',
                    description: 'Optional max results',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: [],
        },
    },
    {
        name: 'create_signature_request',
        description: `Creates a new signature request for a specific account, faculty, and rule.
Returns the created request with its status and required signatures.
This is a WRITE operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                idAccount: {
                    type: 'string',
                    description: 'UUID of the account',
                },
                idFaculty: {
                    type: 'string',
                    description: 'UUID of the faculty',
                },
                idRule: {
                    type: 'string',
                    description: 'UUID of the signature rule',
                },
                referenceId: {
                    type: 'string',
                    description: 'Optional external reference ID',
                },
                referenceType: {
                    type: 'string',
                    description: 'Optional reference type',
                },
                description: {
                    type: 'string',
                    description: 'Optional description',
                },
                expiresAt: {
                    type: 'string',
                    description: 'Optional ISO 8601 expiration datetime',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['idAccount', 'idFaculty', 'idRule'],
        },
    },
    {
        name: 'add_signature',
        description: `Adds a signature to an existing signature request.
Automatically evaluates if the request is now fully signed.
This is a WRITE operation.`,
        inputSchema: {
            type: 'object',
            properties: {
                requestId: {
                    type: 'string',
                    description: 'UUID of the signature request',
                },
                idSigner: {
                    type: 'string',
                    description: 'UUID of the signer',
                },
                idGroup: {
                    type: 'string',
                    description: 'UUID of the signer group',
                },
                ipAddress: {
                    type: 'string',
                    description: 'Optional IP address of the signer',
                },
                userAgent: {
                    type: 'string',
                    description: 'Optional user agent string',
                },
                organizationId: {
                    type: 'string',
                    description: 'Optional organization ID (defaults to env var DEFAULT_ORG_ID)',
                },
            },
            required: ['requestId', 'idSigner', 'idGroup'],
        },
    },
];
function evaluateRule(rule, signatures) {
    const details = [];
    const satisfied = evaluateNode(rule, signatures, details);
    return {
        satisfied,
        explanation: satisfied
            ? 'The rule is SATISFIED. All required conditions are met.'
            : 'The rule is NOT satisfied. See details for missing requirements.',
        details,
    };
}
function evaluateNode(node, signatures, details) {
    // Group condition
    if (node.group !== undefined && node.min !== undefined) {
        const current = signatures[node.group] || 0;
        const satisfied = current >= node.min;
        details.push({
            condition: `${node.min} signature(s) from group "${node.group}"`,
            satisfied,
            current,
            required: node.min,
            group: node.group,
        });
        return satisfied;
    }
    // ALL condition
    if (node.all) {
        const results = node.all.map((child) => evaluateNode(child, signatures, details));
        return results.every((r) => r);
    }
    // ANY condition
    if (node.any) {
        const results = node.any.map((child) => evaluateNode(child, signatures, details));
        return results.some((r) => r);
    }
    return false;
}
// ─────────────────────────────────────────────────────────────────────────────
// Tool Handlers
// ─────────────────────────────────────────────────────────────────────────────
async function handleToolCall(name, args) {
    const orgId = args.organizationId || DEFAULT_ORG_ID;
    switch (name) {
        case 'check_api_health': {
            const response = await httpGet('/health', orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'get_signature_schema': {
            const schemaId = args.schemaId;
            // Note: The API doesn't have a direct schema endpoint.
            // We fetch rules for the schema instead.
            const response = await httpGet(`/signature-rules?schemaId=${schemaId}`, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'get_signature_rules': {
            const schemaId = args.schemaId;
            const facultyId = args.facultyId;
            let path = `/signature-rules?schemaId=${schemaId}`;
            if (facultyId) {
                path += `&facultyId=${facultyId}`;
            }
            const response = await httpGet(path, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'get_rule_combinations': {
            const ruleId = args.ruleId;
            const response = await httpGet(`/signature-rules/${ruleId}/combinations`, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'get_signature_request_status': {
            const requestId = args.requestId;
            const response = await httpGet(`/signature-requests/${requestId}`, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'simulate_signature_evaluation': {
            const ruleId = args.ruleId;
            const signatures = args.signatures;
            // Fetch the rule definition first
            const ruleResponse = await httpGet(`/signature-rules/${ruleId}`, orgId);
            if (!ruleResponse.ok) {
                return JSON.stringify({
                    error: 'Failed to fetch rule',
                    details: ruleResponse.data,
                });
            }
            // Evaluate locally (pure computation, no state changes)
            const ruleDefinition = ruleResponse.data.data.ruleDefinition;
            const result = evaluateRule(ruleDefinition, signatures);
            return JSON.stringify({
                simulation: true,
                note: 'This is a client-side simulation. No data was persisted.',
                ruleId,
                providedSignatures: signatures,
                result,
            }, null, 2);
        }
        case 'explain_authorization_decision': {
            const ruleId = args.ruleId;
            const signatures = args.signatures;
            // Fetch the rule and its combinations
            const [ruleResponse, combinationsResponse] = await Promise.all([
                httpGet(`/signature-rules/${ruleId}`, orgId),
                httpGet(`/signature-rules/${ruleId}/combinations`, orgId),
            ]);
            if (!ruleResponse.ok) {
                return JSON.stringify({
                    error: 'Failed to fetch rule',
                    details: ruleResponse.data,
                });
            }
            const rule = ruleResponse.data.data;
            const evaluation = evaluateRule(rule.ruleDefinition, signatures);
            // Find the "closest" combination if not satisfied
            let suggestion = '';
            if (!evaluation.satisfied && combinationsResponse.ok) {
                const combinations = combinationsResponse.data.data;
                const missingPerCombo = combinations.map((combo) => {
                    let totalMissing = 0;
                    const missing = {};
                    for (const [group, required] of Object.entries(combo)) {
                        const have = signatures[group] || 0;
                        if (have < required) {
                            missing[group] = required - have;
                            totalMissing += required - have;
                        }
                    }
                    return { combo, missing, totalMissing };
                });
                const best = missingPerCombo.sort((a, b) => a.totalMissing - b.totalMissing)[0];
                if (best && best.totalMissing > 0) {
                    const missingStr = Object.entries(best.missing)
                        .map(([g, n]) => `${n} more from group "${g}"`)
                        .join(', ');
                    suggestion = `Closest path to satisfaction: ${missingStr}`;
                }
            }
            return JSON.stringify({
                ruleName: rule.name,
                ruleId,
                providedSignatures: signatures,
                decision: evaluation.satisfied ? 'AUTHORIZED' : 'NOT_AUTHORIZED',
                explanation: evaluation.explanation,
                conditionDetails: evaluation.details,
                suggestion: suggestion || undefined,
                note: 'This is a read-only explanation. No data was modified.',
            }, null, 2);
        }
        // ─── Write API Tools ──────────────────────────────────────────────
        case 'seed_database': {
            const response = await httpPost('/seed', {});
            return JSON.stringify(response, null, 2);
        }
        case 'ingest_transaction': {
            const body = {
                idAccount: args.idAccount,
                type: args.type,
                amount: args.amount,
                currency: args.currency,
                datetime: args.datetime,
            };
            if (args.amountNormalized !== undefined)
                body.amountNormalized = args.amountNormalized;
            if (args.currencyNormalized !== undefined)
                body.currencyNormalized = args.currencyNormalized;
            if (args.country !== undefined)
                body.country = args.country;
            if (args.counterpartyId !== undefined)
                body.counterpartyId = args.counterpartyId;
            if (args.channel !== undefined)
                body.channel = args.channel;
            if (args.metadata !== undefined)
                body.metadata = args.metadata;
            const response = await httpPost('/transactions', body, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'create_rule_template': {
            const body = {
                code: args.code,
                name: args.name,
            };
            if (args.description !== undefined)
                body.description = args.description;
            if (args.category !== undefined)
                body.category = args.category;
            if (args.isActive !== undefined)
                body.isActive = args.isActive;
            const response = await httpPost('/rule-templates', body, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'create_rule_version': {
            const templateId = args.templateId;
            const body = {
                idRuleTemplate: templateId,
                conditions: args.conditions,
                actions: args.actions,
            };
            if (args.window !== undefined)
                body.window = args.window;
            if (args.priority !== undefined)
                body.priority = args.priority;
            if (args.enabled !== undefined)
                body.enabled = args.enabled;
            const response = await httpPost(`/rule-templates/${templateId}/versions`, body, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'list_rule_templates': {
            const response = await httpGet('/rule-templates', orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'get_rule_template': {
            const templateId = args.templateId;
            const response = await httpGet(`/rule-templates/${templateId}`, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'list_active_rule_versions': {
            const response = await httpGet('/rule-versions/active', orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'list_rule_versions': {
            const templateId = args.templateId;
            const response = await httpGet(`/rule-templates/${templateId}/versions`, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'deactivate_rule_version': {
            const versionId = args.versionId;
            const body = {};
            if (args.deactivatedAt !== undefined)
                body.deactivatedAt = args.deactivatedAt;
            const response = await httpPut(`/rule-versions/${versionId}/deactivate`, body, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'list_alerts': {
            const params = new URLSearchParams();
            if (args.idAccount)
                params.append('idAccount', args.idAccount);
            if (args.status)
                params.append('status', args.status);
            if (args.severity)
                params.append('severity', args.severity);
            if (args.category)
                params.append('category', args.category);
            if (args.limit)
                params.append('limit', String(args.limit));
            const qs = params.toString();
            const response = await httpGet(`/alerts${qs ? '?' + qs : ''}`, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'update_alert_status': {
            const alertId = args.alertId;
            const body = { status: args.status };
            const response = await httpPut(`/alerts/${alertId}`, body, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'list_transactions': {
            const params = new URLSearchParams();
            if (args.idAccount)
                params.append('idAccount', args.idAccount);
            if (args.type)
                params.append('type', args.type);
            if (args.startDate)
                params.append('startDate', args.startDate);
            if (args.endDate)
                params.append('endDate', args.endDate);
            if (args.limit)
                params.append('limit', String(args.limit));
            const qs2 = params.toString();
            const response = await httpGet(`/transactions${qs2 ? '?' + qs2 : ''}`, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'list_evaluation_results': {
            const params = new URLSearchParams();
            if (args.idTransaction)
                params.append('idTransaction', args.idTransaction);
            if (args.idAccount)
                params.append('idAccount', args.idAccount);
            if (args.decision)
                params.append('decision', args.decision);
            if (args.limit)
                params.append('limit', String(args.limit));
            const qs3 = params.toString();
            const response = await httpGet(`/transactions/evaluations${qs3 ? '?' + qs3 : ''}`, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'create_signature_request': {
            const body = {
                idAccount: args.idAccount,
                idFaculty: args.idFaculty,
                idRule: args.idRule,
            };
            if (args.referenceId !== undefined)
                body.referenceId = args.referenceId;
            if (args.referenceType !== undefined)
                body.referenceType = args.referenceType;
            if (args.description !== undefined)
                body.description = args.description;
            if (args.expiresAt !== undefined)
                body.expiresAt = args.expiresAt;
            const response = await httpPost('/signature-requests', body, orgId);
            return JSON.stringify(response, null, 2);
        }
        case 'add_signature': {
            const requestId = args.requestId;
            const body = {
                idSigner: args.idSigner,
                idGroup: args.idGroup,
            };
            if (args.ipAddress !== undefined)
                body.ipAddress = args.ipAddress;
            if (args.userAgent !== undefined)
                body.userAgent = args.userAgent;
            const response = await httpPost(`/signature-requests/${requestId}/signatures`, body, orgId);
            return JSON.stringify(response, null, 2);
        }
        default:
            // Check if it's a database tool
            if (dbTools.some((t) => t.name === name)) {
                return handleDbToolCall(name, args);
            }
            // Check if it's an explanation tool
            if (explanationTools.some((t) => t.name === name)) {
                return handleExplanationToolCall(name, args);
            }
            return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Combined Tool List
// ─────────────────────────────────────────────────────────────────────────────
// All tools available in this MCP server
const allTools = [...apiTools, ...writeApiTools, ...dbTools, ...explanationTools];
// ─────────────────────────────────────────────────────────────────────────────
// MCP Server Setup
// ─────────────────────────────────────────────────────────────────────────────
const server = new Server({
    name: 'complif-mcp-server',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: allTools };
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        const result = await handleToolCall(name, args);
        return {
            content: [{ type: 'text', text: result }],
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }) }],
            isError: true,
        };
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Complif MCP Server running on stdio');
    console.error(`API Base URL: ${API_BASE_URL}`);
    console.error(`Default Org ID: ${DEFAULT_ORG_ID}`);
    console.error(`Database URI: ${DATABASE_URI.replace(/:[^:@]+@/, ':***@')}`);
    // Check database connectivity (non-blocking)
    checkConnection()
        .then((ok) => {
        console.error(`Database connection: ${ok ? 'OK' : 'FAILED'}`);
    })
        .catch((err) => {
        console.error(`Database connection check failed: ${err.message}`);
    });
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map