---
name: docker-local-development
description: Enforces the use of Docker Compose for all local development tasks. Never run the API directly, never create standalone containers, always use the docker-compose.yml infrastructure.
---

# Docker-First Local Development

## Overview

This project uses **Docker Compose** as the single source of truth for the local
development environment. All services (API, PostgreSQL, Redis, MCP) are defined
in `rule-engine/docker-compose.yml` and must be managed exclusively through
`docker compose` commands.

---

## When to Use

Use this skill whenever you need to:

- Start, stop, or restart any service (API, database, cache, etc.)
- Run the API server locally
- Run load tests or stress tests against the API
- Debug infrastructure issues (ports, connectivity, health)
- Add new infrastructure services (message queues, etc.)

---

## Golden Rules

### 1. NEVER run the API directly with `npx`, `nest start`, `npm run start`, or `node`

The API runs inside a Docker container. Always use:

```bash
cd rule-engine && docker compose up -d app
```

To rebuild after code changes:

```bash
cd rule-engine && docker compose up -d --build app
```

To see live logs:

```bash
docker compose -f rule-engine/docker-compose.yml logs -f app
```

### 2. NEVER create standalone containers with `docker run`

All services are defined in `docker-compose.yml`. If you need Redis, Postgres,
or any other service, bring it up through Compose:

```bash
# Correct — uses the compose network, volumes, and healthchecks
cd rule-engine && docker compose up -d redis

# WRONG — creates an orphan container outside the compose network
docker run -d --name my-redis -p 6379:6379 redis:7-alpine
```

### 3. ALWAYS use `docker compose` to manage the full stack

```bash
# Start everything (postgres + redis + app + mcp)
cd rule-engine && docker compose up -d

# Start only infra (for running tests locally against the DB)
cd rule-engine && docker compose up -d postgres redis

# Rebuild and restart app after code changes
cd rule-engine && docker compose up -d --build app

# Stop everything
cd rule-engine && docker compose down

# Stop and remove volumes (full reset)
cd rule-engine && docker compose down -v
```

### 4. Check service status with `docker compose`, not `lsof` or `ps`

```bash
cd rule-engine && docker compose ps
docker compose -f rule-engine/docker-compose.yml logs --tail=20 app
```

### 5. If Docker Desktop is not running, start it first

Before any `docker compose` command, verify Docker is available:

```bash
docker info 2>&1 | head -3
```

If it fails, tell the user to start Docker Desktop — do not fall back to
running services natively.

---

## Service Map

| Service     | Container Name   | Port | Purpose                    |
| ----------- | ---------------- | ---- | -------------------------- |
| postgres    | complif-postgres | 5432 | Primary database           |
| redis       | complif-redis    | 6379 | Cache layer for hot paths  |
| app         | complif-api      | 3000 | NestJS API server          |
| complif-mcp | complif-mcp      | —    | MCP sidecar (stdin/stdout) |

---

## Common Workflows

### Run load test / stress test

```bash
# 1. Bring up the full stack
cd rule-engine && docker compose up -d --build

# 2. Wait for app to be healthy
docker compose -f rule-engine/docker-compose.yml logs -f app | head -50

# 3. Seed data
curl -s -X POST http://localhost:3000/seed | jq .

# 4. Run k6
k6 run rule-engine/scripts/load-test.js
```

### Run e2e tests (tests run on host, DB in Docker)

```bash
# 1. Ensure postgres + redis are running
cd rule-engine && docker compose up -d postgres redis

# 2. Run tests (they connect to localhost:5432 and localhost:6379)
cd rule-engine && npx jest --config test/jest-e2e.json --forceExit
```

### Add a new infrastructure service

1. Define it in `docker-compose.yml` with healthcheck and volume
2. Add it as a dependency of `app` if the app needs it
3. Expose the connection via environment variables in the `app` service
4. Never create it as a standalone `docker run` container

---

## Anti-Patterns (NEVER DO)

| What                                        | Why it's wrong                                   |
| ------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| `npx nest start`                            | Bypasses Docker; misses env vars, network, Redis |
| `npm run start`                             | Same as above                                    |
| `node dist/main.js`                         | Same as above                                    |
| `docker run -d -p 6379:6379 redis:7-alpine` | Orphan container, not on compose network         |
| `docker run -d -p 5432:5432 postgres:15`    | Orphan container, no init script, no healthcheck |
| Killing port with `lsof -ti:3000            | xargs kill`                                      | Indicates a process was started outside of Docker |

---

## Exception: Unit Tests

Unit tests (`npx jest --testPathIgnorePatterns='e2e'`) do NOT require Docker
since they mock all infrastructure. Only e2e tests and the running API need
the Docker stack.
