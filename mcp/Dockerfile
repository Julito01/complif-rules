# ─────────────────────────────────────────────────────────────────────────────
# Complif MCP Server - Dockerfile
#
# This builds a minimal container for the MCP server.
# The server uses STDIO transport (not HTTP), so no ports are exposed.
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript from builder
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S mcp && \
    adduser -S mcp -u 1001 -G mcp

USER mcp

# Environment variables (can be overridden at runtime)
ENV NODE_ENV=production
ENV API_BASE_URL=http://api:3000
ENV DEFAULT_ORG_ID=complif-001

# MCP servers use STDIO, not HTTP - no ports exposed
# The server will be invoked by VS Code/Claude and communicate via stdin/stdout

# Default command
CMD ["node", "dist/index.js"]
