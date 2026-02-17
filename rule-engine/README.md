# Complif — Rule Engine & Compliance Platform

Backend challenge implementation covering **Part 0** (Signature & Authorization) and **Part 1** (Rule Engine & Compliance Monitoring).

---

## Tech Stack

| Layer      | Technology                   |
| ---------- | ---------------------------- |
| Runtime    | Node.js 20+ / TypeScript 5   |
| Framework  | NestJS 10                    |
| Database   | PostgreSQL 15 (via TypeORM)  |
| Cache      | Redis 7 (via ioredis)        |
| Containers | Docker Compose               |
| Testing    | Jest (unit + e2e)            |
| Load Test  | k6                           |
| Logging    | Pino (structured JSON)       |
| MCP Server | TypeScript + stdio transport |

---

## Prerequisites

- **Docker** & **Docker Compose** (v2+)
- **Node.js 20+** and **npm** (for local dev / tests only)

---

## Quick Start

```bash
# 1. Start the stack (postgres + api + mcp)
docker compose up -d --build

# 2. Wait for the API to be healthy
curl http://localhost:3000/health

# 3. Seed deterministic test data (both Part 0 and Part 1)
curl -X POST http://localhost:3000/seed -H 'x-organization-id: complif-001'
```

The API is available at `http://localhost:3000`.

### Local development (without Docker)

> Note: challenge workflow is Docker-first. Prefer `docker compose up -d --build` for evaluation and demo consistency.

```bash
npm install

# Ensure a Postgres instance is running on localhost:5432 with user/pass/db = complif
npm run start:dev
```

---

## Running Tests

```bash
npm test                 # all unit tests
npm run test:cov         # with coverage
npm run test:e2e         # end-to-end tests
```

**255+ unit tests** across 15 suites + **109 e2e tests** — all passing.  
Test coverage: **~94% statements, ~80% branches**.

---

## Project Structure

```
src/
├── app.module.ts                  # Root module
├── main.ts                        # Bootstrap (port 3000)
├── config/                        # Database & env config
├── database/seeds/                # Deterministic seed data
├── shared/                        # Base entity, domain exceptions, filters, guards
└── modules/
    ├── signature/                 # Part 0 — Signature & Authorization
    │   ├── domain/
    │   │   ├── entities/          # Account, Signer, SignerGroup, Faculty,
    │   │   │                      #   SignatureSchema, SignatureRule, SignatureRequest, Signature
    │   │   ├── services/          # RuleEvaluator (combinatorics engine)
    │   │   └── value-objects/     # FacultyCode, RuleDefinition, RequestStatus, SignatureStatus
    │   ├── application/           # SignatureRuleService, SignatureRequestService
    │   └── infrastructure/
    │       ├── controllers/       # /signature-rules, /signature-requests
    │       └── dto/               # Validation DTOs
    └── compliance/                # Part 1 — Rule Engine & Compliance
        ├── domain/
        │   ├── entities/          # RuleTemplate, RuleVersion, Transaction,
        │   │                      #   EvaluationResult, Alert
        │   ├── services/          # ConditionEvaluator, WindowCalculator,
        │   │                      #   RuleVersionSelector, TransactionEvaluationEngine
        │   └── value-objects/     # ConditionNode, EvaluationDecision, AlertSeverity, AlertStatus
        ├── application/           # RuleManagementService, TransactionEvaluationService
        └── infrastructure/
            ├── controllers/       # /rule-templates, /rule-versions, /transactions, /alerts
            └── dto/               # Validation DTOs
```

---

## Architecture

- **Domain-Driven Design** — clear bounded contexts (Signature vs Compliance), pure domain services with no framework dependencies.
- **Multi-tenant isolation** — `OrganizationGuard` injects `x-organization-id` header; every query scopes to the caller's org.
- **Immutable rule versions** — templates are mutable drafts; publishing creates an immutable version and deactivates the previous one.
- **Atomic transaction ingestion** — ingest → evaluate → persist all wrapped in a single database transaction.
- **Pure condition evaluator** — 14 operators (equal, notEqual, greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual, in, notIn, contains, notContains, exists, notExists, **between**, **regex**) plus **AND / OR / NOT** combinators, with full evaluation traces.
- **Sliding time windows** — `WindowCalculator` computes aggregations (COUNT, SUM, AVG, MAX, MIN) over rolling time periods using raw SQL.
- **Redis caching** — read-through cache for active rule versions (60s TTL) and compliance list facts (30s TTL) with graceful degradation if Redis is unavailable.
- **Structured logging** — Pino JSON logs with request correlation IDs, configurable log levels.

### Template baseline policy (`isSystem`)

- `isSystem` in this project is **organization-scoped**, not global/platform-wide.
- A **baseline template** is defined as `isSystem=true` and `parentTemplateId=null`.
- The service enforces a simple safety rule:
  - Non-system templates require at least one active baseline in the same organization.
  - The last active baseline of an organization cannot be deactivated.

---

## Part 0 — Signature & Authorization

### Endpoints

| Method | Path                                 | Description                                                  |
| ------ | ------------------------------------ | ------------------------------------------------------------ |
| POST   | `/signature-rules`                   | Create a signature rule (schema + groups + faculties + rule) |
| GET    | `/signature-rules`                   | List rules for the organization                              |
| GET    | `/signature-rules/:id`               | Get rule by ID                                               |
| PUT    | `/signature-rules/:id`               | Update rule definition                                       |
| DELETE | `/signature-rules/:id`               | Delete rule                                                  |
| GET    | `/signature-rules/:id/combinations`  | Get valid signature combinations                             |
| POST   | `/signature-requests`                | Create a signature request (linked to account + rule)        |
| GET    | `/signature-requests/:id`            | Get request status + collected signatures                    |
| POST   | `/signature-requests/:id/signatures` | Add a signature                                              |
| POST   | `/signature-requests/:id/cancel`     | Cancel a pending request                                     |

### Core Flow

1. **Define a rule** — POST `/signature-rules` with schema (groups, faculties, authorization rule).
2. **Create a request** — POST `/signature-requests` links an account to a rule.
3. **Collect signatures** — POST `/signature-requests/:id/signatures` adds each signer's signature.
4. **Auto-resolution** — when collected signatures satisfy the rule's combinatorics, the request moves to `APPROVED`.

### Postman Collection

Import `postman/Complif-Signature-Module.postman_collection.json`.

---

## Part 1 — Rule Engine & Compliance

### Endpoints

| Method | Path                                   | Description                                            |
| ------ | -------------------------------------- | ------------------------------------------------------ |
| POST   | `/rule-templates`                      | Create a compliance rule template                      |
| GET    | `/rule-templates`                      | List all templates                                     |
| GET    | `/rule-templates/:id`                  | Get template by ID                                     |
| PUT    | `/rule-templates/:id/deactivate`       | Deactivate a template                                  |
| POST   | `/rule-templates/:templateId/versions` | Publish an immutable rule version                      |
| GET    | `/rule-templates/:templateId/versions` | List versions for a template                           |
| GET    | `/rule-versions/active`                | List all active rule versions                          |
| GET    | `/rule-versions/:id`                   | Get a version by ID                                    |
| PUT    | `/rule-versions/:id/deactivate`        | Deactivate a version                                   |
| POST   | `/transactions`                        | Ingest & evaluate a transaction                        |
| GET    | `/transactions`                        | List transactions                                      |
| GET    | `/transactions/evaluations`            | List evaluation results                                |
| GET    | `/alerts`                              | List compliance alerts (filterable by severity/status) |
| GET    | `/alerts/:id`                          | Get alert by ID                                        |
| PUT    | `/alerts/:id`                          | Update alert status                                    |

### Core Flow

1. **Define rules** — create templates (`POST /rule-templates`) then publish versions with conditions, actions, and priority.
2. **Ingest a transaction** — `POST /transactions` persists the transaction, loads all active rule versions, builds evaluation facts (including sliding-window aggregations), evaluates every rule, persists `EvaluationResult`, and generates alerts for triggered rules — all atomically.
3. **Monitor alerts** — `GET /alerts` to review, `PUT /alerts/:id` to acknowledge/resolve.

### Condition Tree Example

```json
{
  "all": [
    { "fact": "transaction.amount", "operator": "greaterThan", "value": 10000 },
    {
      "not": {
        "fact": "transaction.country",
        "operator": "in",
        "value": ["AR", "UY"]
      }
    },
    {
      "any": [
        { "fact": "transaction.type", "operator": "equal", "value": "CASH_OUT" },
        { "fact": "aggregations.sum_amount_24h", "operator": "greaterThan", "value": 50000 }
      ]
    }
  ]
}
```

### Postman Collection

Import `postman/Complif-Compliance-Module.postman_collection.json`.

---

## Seed Data

`POST /seed` creates deterministic data for both modules:

| Entity          | Seed ID             | Description                       |
| --------------- | ------------------- | --------------------------------- |
| Account         | `a000-000000000001` | Test account                      |
| Signer 1        | `a000-000000000002` | First signer                      |
| Signer 2        | `a000-000000000003` | Second signer                     |
| Rule Template 1 | `b000-000000000001` | HIGH_AMOUNT_THRESHOLD             |
| Rule Template 2 | `b000-000000000002` | VELOCITY_CHECK                    |
| Rule Version 1  | `b000-000000000010` | Amount > 10000 → REVIEW alert     |
| Rule Version 2  | `b000-000000000011` | COUNT txs in 24h > 5 → HIGH alert |

All UUIDs are prefixed `00000000-0000-4000-XXXX-XXXXXXXXXXXX`.

---

## MCP Server

An MCP (Model Context Protocol) server exposes **30 tools** for AI-assisted compliance workflows:

- Database schema inspection (tables, rows, samples)
- Seed, health check
- Rule template & version CRUD
- Transaction ingestion & querying
- Alert management
- Aggregation explanation (pure computation)
- Rule evaluation explanation (pure computation)
- Signature rule management, requests, authorization decisions

Run standalone: `npx tsx ../mcp/src/index.ts`

---

## Part 2 — AI Workflow

The project is fully prepared for AI-assisted development and maintenance:

### Agent Configuration

- **`.cursorrules`** — Project context, architecture rules, and coding conventions for Cursor/AI agents.
- **`.github/copilot-instructions.md`** — GitHub Copilot-specific instructions.

### Agent Skills (25 skills in `.github/skills/`)

Domain-specific knowledge files that guide AI agents on how to implement, extend, or debug features:

| Category             | Skills                                                                                                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Part 0 (Signatures)  | `signature-domain`, `signature-schema-modeler`, `signature-combinatorics`, `signature-request-lifecycle`, `ddd-part-0`                                                                                                                                            |
| Part 1 (Compliance)  | `rule-evaluation-flow`, `rule-templates-and-versioning`, `aggregations-and-windows`, `behavioral-rules`, `compliance-lists`, `condition-operators-extension`, `alert-deduplication`, `template-inheritance`, `json-interpretation`, `transaction-model-alignment` |
| NFR / Infrastructure | `performance-metrics`, `redis-cache`, `test-coverage`, `structured-logging`, `docker-local-development`, `technical-requirements`                                                                                                                                 |
| General              | `senior-backend`, `ddd-part-1`, `challenge-deliverables-minimum`                                                                                                                                                                                                  |

### MCP Server (30 tools in `mcp/`)

A Model Context Protocol server that exposes the full compliance domain to AI agents:

- **Database**: schema inspection, table sampling, row counting
- **Rules**: template CRUD, version management, activation/deactivation
- **Transactions**: ingestion, querying, evaluation results
- **Alerts**: listing, status updates
- **Explainers**: rule evaluation simulation, aggregation explanation (pure computation, no side effects)
- **Signatures**: rule management, request lifecycle, authorization decisions

---

## Benchmarks

Load test results using k6 with 20 concurrent virtual users over 75 seconds:

| Metric                  | Target        | Result           | Status |
| ----------------------- | ------------- | ---------------- | ------ |
| **Throughput**          | >= 50 txn/sec | **85.7 txn/sec** | PASS   |
| **Eval latency avg**    | —             | **12ms**         | —      |
| **Eval latency p95**    | —             | **34ms**         | —      |
| **Eval latency p99**    | < 100ms       | **< 100ms**      | PASS   |
| **HTTP round-trip p99** | < 500ms       | **< 500ms**      | PASS   |
| **Error rate**          | < 1%          | **0%**           | PASS   |
| **Total requests**      | —             | **6,439**        | —      |

Run yourself: `k6 run scripts/load-test.js` (requires [k6](https://k6.io/))

---

## Trade-offs & Assumptions

| Decision                           | Rationale                                                                                                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `synchronize: true`                | Acceptable for a challenge; production would use migrations.                                                                                                                                  |
| In-process evaluation              | Rules evaluated synchronously during ingestion. A queue-based approach would be more scalable.                                                                                                |
| No authentication                  | Multi-tenant isolation via header only; production would use JWT/OAuth.                                                                                                                       |
| Single active version per template | Publishing a new version auto-deactivates the previous one — simpler than allowing multiple active versions.                                                                                  |
| `window` quoted in SQL             | PostgreSQL reserved word — all raw SQL uses `"window"`.                                                                                                                                       |
| Sliding windows via raw SQL        | Aggregations computed at evaluation time rather than pre-materialized. Sufficient for challenge throughput.                                                                                   |
| Redis graceful degradation         | If Redis is down, the API falls back to direct DB reads — no crashes, just higher latency.                                                                                                    |
| Webhook/queue actions modeled only | Action types `webhook` and `publish_queue` are stored in the rule config and used for decision logic, but outbound delivery is not implemented (would require an async worker in production). |

---

## Docker Compose Services

| Service       | Port | Description                         |
| ------------- | ---- | ----------------------------------- |
| `postgres`    | 5432 | PostgreSQL 15 Alpine                |
| `redis`       | 6379 | Redis 7 Alpine (rule cache)         |
| `app`         | 3000 | NestJS API                          |
| `complif-mcp` | —    | MCP server (stdio, no exposed port) |

```bash
docker compose up -d --build   # start all
docker compose logs -f app     # follow API logs
docker compose down -v         # stop & remove volumes
```
