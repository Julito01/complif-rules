# Complif — Backend Challenge

See [rule-engine/README.md](rule-engine/README.md) for the full project documentation including setup instructions, API reference, architecture decisions, and trade-offs.

## Quick Start

```bash
cd rule-engine
docker compose up -d --build
curl -X POST http://localhost:3000/seed -H 'x-organization-id: complif-001'
```

## Project Structure

- **rule-engine/** — NestJS API (Part 0: Signatures + Part 1: Compliance)
- **mcp/** — MCP Server (AI-assisted compliance tools)
- **.github/skills/** — Agent skills for development guidance
