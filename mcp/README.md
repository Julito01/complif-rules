# Complif MCP Server

An MCP (Model Context Protocol) server that provides AI agents with controlled access to the Complif API and database-inspection tools for development, testing, and reasoning.

## Overview

This is a **tool adapter**, not a service. It contains:

- ❌ NO business logic
- ❌ NO authorization/compliance logic
- ✅ API tools (read + write), DB inspection (read-only), and pure explanation/simulation tools

## Available Tools

The server exposes a comprehensive toolset grouped by category:

- **Signature domain**: schema/rules lookup, request status, combinations, explanation
- **Compliance domain**: rule templates/versions, transaction ingestion/query, alerts
- **Database inspection**: schema, table metadata, row counts, samples (read-only)
- **Explanation tools**: pure reasoning helpers for aggregation and rule evaluation

See runtime source for the authoritative tool list:

- `mcp/src/index.ts`

## Setup

### Prerequisites

- Node.js 18+
- The Complif API running (default: `http://localhost:3000`)

### Installation

```bash
cd mcp
npm install
npm run build
```

### Configuration

Environment variables:

| Variable         | Default                 | Description                          |
| ---------------- | ----------------------- | ------------------------------------ |
| `API_BASE_URL`   | `http://localhost:3000` | Base URL of the Complif API          |
| `DEFAULT_ORG_ID` | `complif-001`           | Default organization ID for requests |

## Usage

### VS Code Integration

The MCP server is configured in `.vscode/mcp.json`:

```jsonc
{
  "servers": {
    "complif-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/mcp/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3000",
        "DEFAULT_ORG_ID": "complif-001",
      },
    },
  },
}
```

### Docker

The server is also available as a Docker container:

```bash
# Build
docker compose -f rule-engine/docker-compose.yml build complif-mcp

# The container runs with stdin_open and tty for MCP stdio transport
```

### Manual Testing

```bash
# Build and run
npm run build
node dist/index.js

# The server reads from stdin and writes to stdout
# Use MCP protocol messages to interact
```

## Architecture

```
┌─────────────────┐     stdio      ┌─────────────────┐
│   VS Code /     │◄──────────────►│  Complif MCP    │
│   Claude        │                │  Server         │
└─────────────────┘                └────────┬────────┘
                                            │
                                            │ HTTP API + DB inspection
                                            ▼
                                   ┌─────────────────┐
                                   │  Complif API    │
                                   │  (NestJS)       │
                                   └─────────────────┘
```

## Security Notes

1. **Tool adapter only**: no business rules are implemented in MCP; all business behavior lives in the API.
2. **Mixed operation modes**: some API tools are write operations (`create_*`, `ingest_*`, `update_*`), while DB inspection tools are read-only.
3. **Pure explain/simulate tools**: `simulate_*` and `explain_*` tools do not persist anything.
4. **Organization scoping**: API calls include `x-organization-id` header.
5. **No credentials storage**: MCP does not implement auth logic; it forwards requests to the API.

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build
```

## Troubleshooting

### "Connection refused" errors

Ensure the Complif API is running:

```bash
cd rule-engine
docker compose up -d
```

### MCP server not showing in VS Code

1. Ensure the server is built: `npm run build`
2. Restart VS Code to reload MCP configuration
3. Check the Output panel for MCP errors
