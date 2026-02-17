---
name: redis-cache
description: Adds Redis caching layer for active rule versions and compliance lists to meet performance NFRs.
---

# Redis Cache for Evaluation Performance

## Overview

This skill governs introduction of Redis caching for high-read paths in transaction
evaluation, especially active rule versions and compliance list lookups.

The goal is to reduce database load and support throughput/latency non-functional
requirements while preserving deterministic behavior.

---

## When to Use

Use this skill when:

- Adding Redis to local runtime and Docker Compose
- Configuring NestJS cache integration for rule engine reads
- Caching active rule versions and compliance list membership queries
- Designing cache invalidation after writes
- Tuning TTL and cache keys for predictable behavior

---

## Key Concepts

- **Active Rule Cache**: Cached snapshot of enabled rule versions used during evaluation
- **List Lookup Cache**: Cached membership/entry resolution for compliance lists
- **TTL**: Time-to-live policy controlling cache freshness
- **Cache Invalidation**: Explicit key eviction after changes to source-of-truth data
- **Read-Through Strategy**: Service reads cache first, then database on miss

---

## Guidelines

- Add Redis service to Docker Compose and configure env-based connection settings
- Integrate NestJS cache manager with Redis store in infrastructure configuration
- Cache active rule versions with approximately 60s TTL unless stricter requirement exists
- Cache compliance list lookups with approximately 30s TTL unless stricter requirement exists
- Implement explicit invalidation on rule version create/deactivate and list entry create/update/delete
- Use deterministic cache keys including organization scope and query dimensions
- Add tests for cache hit/miss behavior and invalidation paths

### Explicitly Forbidden

- Using cache as source of truth for compliance decisions
- Returning cross-organization cached data
- Caching mutable request-scoped data without stable key strategy
- Skipping invalidation on write paths that affect evaluation behavior
- Introducing Redis-only logic that breaks evaluation when cache is unavailable

---

## Design Rules

- PostgreSQL remains the single source of truth
- Cache layer MUST degrade gracefully: on Redis failure, fallback to DB reads
- Keep caching concerns in application/infrastructure services, not domain entities
- Instrument cache hit/miss counters for operational visibility
- Keep TTL values centralized and configurable via environment variables
- Avoid over-caching low-value paths that add complexity without measurable benefit

---

## Expected Outcome

After applying this skill:

- Active rule and list reads are significantly reduced at database level
- Evaluation throughput improves under concurrent load
- Cache consistency is maintained through explicit invalidation
- Redis caching requirement is implemented without violating domain boundaries
