---
name: technical-requirements
description: Defines the mandatory technical stack, architectural constraints, and tooling requirements for the backend challenge. Use this skill whenever making technical or architectural decisions.
---

# Technical Requirements & Stack Constraints

## Overview

This skill defines the **mandatory technical stack and constraints**
that must be followed when implementing the backend challenge.

It exists to prevent accidental deviation from the expected technologies
and architectural style during development.

---

## When to Use

Use this skill when:

- Choosing languages, frameworks, or libraries
- Designing application architecture
- Writing Docker or infrastructure files
- Making decisions about persistence, APIs, or services
- Setting up project structure or tooling

---

## Mandatory Stack

The implementation MUST use:

- **Language**: TypeScript
- **Runtime**: Node.js
- **API**: REST (HTTP + JSON)
- **Database**: PostgreSQL
- **Containerization**: Docker
- **Local orchestration**: Docker Compose

If an alternative is considered, stop and document why before proceeding.

---

## Architectural Guidelines

- The system MUST be backend-only (no frontend)
- The application SHOULD follow a layered or hexagonal architecture
- Domain logic SHOULD be isolated from infrastructure concerns
- Business logic MUST NOT depend directly on framework-specific APIs

---

## Persistence Rules

- PostgreSQL MUST be the source of truth
- Database schema SHOULD be explicit and normalized
- Migrations MUST be used for schema evolution
- Avoid storing core business logic inside the database

---

## API Guidelines

- APIs MUST be RESTful and JSON-based
- Endpoints SHOULD be versioned if public-facing
- Input validation MUST be explicit
- Error responses SHOULD be consistent and structured

---

## Containerization Rules

- The application MUST be runnable via Docker Compose
- Local development MUST NOT require external services
- Environment variables MUST be used for configuration
- No secrets should be hardcoded

---

## Testing Expectations

- Core business logic SHOULD be unit tested
- Authorization combinatorics SHOULD have explicit test coverage
- Tests SHOULD be runnable locally via npm/yarn scripts

---

## Explicitly Forbidden

- Using a different language or runtime
- Introducing frontend frameworks
- Using managed cloud services directly (AWS, GCP, etc.)
- Tight coupling between domain logic and infrastructure
- Skipping Docker setup

---

## Example

User: “Should we use MongoDB for flexibility?”
Assistant: No. PostgreSQL is mandatory per technical requirements.

User: “Can we use Python for faster prototyping?”
Assistant: No. TypeScript + Node.js are required.
