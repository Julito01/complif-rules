---
name: structured-logging
description: Implements structured JSON logging with correlation IDs for observability and debugging.
---

# Structured Logging with Correlation IDs

## Overview

This skill defines implementation of structured JSON logs and correlation IDs to satisfy
observability requirements and improve debugging in compliance workflows.

It replaces unstructured console output with machine-parseable logs tied to request and
evaluation context.

---

## When to Use

Use this skill when:

- Replacing default logger configuration in the NestJS app
- Adding request correlation and traceability across services
- Defining consistent log schema and log level policies
- Logging evaluation lifecycle events in Part 1
- Integrating logs with monitoring or SIEM pipelines

---

## Key Concepts

- **Structured Log Event**: JSON log record with consistent fields and metadata
- **Correlation ID**: Request-scoped identifier (`X-Request-ID` or `X-Correlation-ID`) propagated through the call chain
- **Log Context**: Stable fields such as organization, account, rule version, transaction ID, duration
- **Event Taxonomy**: Canonical event names for business-relevant lifecycle milestones
- **Log Level Policy**: Environment-specific logging verbosity (`debug`, `info`, `warn`, `error`)

---

## Guidelines

- Use `nestjs-pino` (or equivalent Pino integration) as the structured logger backend
- Emit JSON logs with at least: timestamp, level, message, context, correlation ID
- Add middleware/interceptor to assign and propagate correlation IDs for every request
- Log key lifecycle events: transaction ingested, evaluation started, rule triggered, alert created, evaluation completed
- Include evaluation duration and identifiers needed for end-to-end tracing
- Configure log level via environment variables (`debug` in dev, `info` in prod by default)
- Add tests for correlation ID propagation and structured logger wiring where feasible

### Explicitly Forbidden

- Logging sensitive secrets, credentials, or raw personal data beyond necessity
- Using ad-hoc string-only logs without structured fields
- Emitting logs without correlation ID in request-driven flows
- Duplicating high-volume debug logs in production defaults
- Coupling domain entities directly to logger implementation details

---

## Design Rules

- Logging is infrastructure concern; domain logic MUST remain logger-agnostic
- Log schema SHOULD stay stable and documented for downstream consumers
- Business event logs MUST be deterministic and include canonical identifiers
- Correlation ID propagation SHOULD survive async boundaries in request handling
- Logging failures MUST NOT block transaction evaluation path
- Maintain backward-compatible HTTP behavior while changing logging internals

---

## Expected Outcome

After applying this skill:

- Application logs are JSON-structured and queryable
- Every request/evaluation flow is traceable via correlation ID
- Operational debugging and incident triage are significantly faster
- Structured logging non-functional requirement is satisfied
