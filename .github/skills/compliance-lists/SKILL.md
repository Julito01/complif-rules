---
name: compliance-lists
description: Implements managed blacklist/whitelist entity system for compliance screening during transaction evaluation.
---

# Compliance Lists (Blacklist/Whitelist)

## Overview

This skill governs implementation of managed compliance lists required by the challenge:
blacklists and whitelists of entities used during transaction evaluation.

These lists are persistent domain data, not condition operators, and MUST be integrated
as a fact source in Part 1 rule evaluation.

---

## When to Use

Use this skill when:

- Creating entities for managed compliance lists and entries
- Implementing CRUD APIs for blacklist/whitelist management
- Integrating list membership facts into transaction evaluation
- Designing organization-scoped screening logic
- Validating list-related DTOs, services, and repositories

---

## Key Concepts

- **Compliance List**: Organization-scoped list with `type` (`BLACKLIST`/`WHITELIST`) and `entityType` (`COUNTRY`/`ACCOUNT`/`COUNTERPARTY`)
- **Compliance List Entry**: Atomic value stored in a list (for example country code or counterparty ID)
- **List Membership Fact**: Evaluation-time fact that indicates whether transaction attributes match list entries
- **Fact Provider**: Application service that resolves list membership and exposes deterministic facts to the rule evaluator
- **Organization Isolation**: All list data and lookups are scoped by `organizationId`

---

## Guidelines

- Create a `ComplianceList` entity with at minimum: `id`, `name`, `type`, `entityType`, `organizationId`, timestamps
- Create a `ComplianceListEntry` entity with at minimum: `id`, `listId`, `value`, `metadata`, `createdAt`, timestamps
- Implement CRUD endpoints for lists and list entries in the infrastructure layer with DTO validation
- Enforce uniqueness where needed (for example duplicate `value` in the same list SHOULD be prevented)
- Implement list membership lookups in an application service and expose results as evaluation facts
- Keep rule evaluation deterministic: same input transaction + same historical data => same list facts
- Keep list semantics explicit: blacklist hit and whitelist hit must be distinguishable facts

### Explicitly Forbidden

- Treating this requirement as existing `in`/`not_in` rule operators only
- Hardcoding sanctioned countries/accounts/counterparties in source code
- Mixing organizations in list queries
- Embedding list CRUD behavior directly in domain entities
- Coupling evaluator internals to HTTP controller code

---

## Design Rules

- Follow DDD boundaries: entities/value objects in domain, orchestration in application, persistence/controllers in infrastructure
- Keep list entities independent from rule template entities to preserve bounded-context clarity
- Use TypeORM relations and indexes for efficient membership lookup (`organizationId`, `entityType`, `value`)
- Membership evaluation SHOULD support explicit list targeting (for example list name/code reference)
- Fail safe: missing list references MUST produce a deterministic validation or evaluation error path
- Preserve backward compatibility for existing structural rule evaluation paths

---

## Expected Outcome

After applying this skill:

- Compliance lists are first-class, managed entities with CRUD APIs
- Transaction evaluation can consume blacklist/whitelist membership as facts
- Screening behavior is auditable, deterministic, and organization-isolated
- The blacklist/whitelist challenge requirement is satisfied as a real data model feature
