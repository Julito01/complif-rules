## Complif — Copilot Instructions

This is the **Complif** backend challenge: a real-time compliance rule engine with signature authorization built with NestJS 10 + TypeScript 5 + PostgreSQL 15 + Redis 7.

### Project Structure

- `rule-engine/` — Main NestJS API (Part 0: Signatures + Part 1: Compliance)
- `mcp/` — MCP server with 30 AI tools
- `.github/skills/` — 25 domain-specific agent skills

### Key Rules

1. **Docker first**: Always use `docker compose up -d --build` — never run the API directly.
2. **DDD architecture**: Domain entities, value objects, application services, infrastructure controllers.
3. **Multi-tenant**: All queries scoped by `idOrganization` from `x-organization-id` header.
4. **Immutable versions**: Rule versions are immutable; publishing deactivates the previous version.
5. **Tests required**: Coverage > 80%. Unit tests alongside source, e2e in `test/`.

### Before Making Changes

Check `.github/skills/` for domain guidance — especially `docker-local-development`, `rule-evaluation-flow`, `signature-domain`, and `technical-requirements`.

### Performance Targets

- p99 eval latency < 100ms
- Throughput >= 50 txn/sec
- Redis caching for active rules and compliance lists
