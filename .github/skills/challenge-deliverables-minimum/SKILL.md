---
name: challenge-deliverables-minimum
description: Ensures minimum challenge deliverables are complete with pragmatic scope: README, Part 1 API collection/OpenAPI, and verification steps.
---

# Challenge Deliverables Minimum

## Overview

Use this skill to complete mandatory deliverables with minimal scope creep.

Focus on required outputs only:

1. README with install and usage
2. API collection or OpenAPI for Part 1
3. Clear local run and verification flow

---

## When to Use

Use this skill when:

- Replacing boilerplate README content
- Documenting Part 1 endpoints and flows
- Building Postman/Insomnia or OpenAPI artifacts
- Preparing final handoff for reviewers

---

## Required README Sections

At minimum include:

- Project purpose and challenge scope (Part 0 + Part 1)
- Stack and architecture summary
- Prerequisites (Docker, Node, etc.)
- Local setup (`docker compose up`, seed instructions)
- How to run tests
- Core API flows (signature + compliance)
- Trade-offs and assumptions

Keep examples executable and aligned with current endpoints.

---

## API Artifact Requirement

Provide at least one complete option:

- Part 1 Postman collection, or
- OpenAPI spec

Coverage should include:

- Rule templates
- Rule versions
- Transaction ingestion/evaluation
- Alerts list and status update

---

## Quality Bar

- Commands in docs must run as written
- No stale endpoint paths
- Organization header requirements documented
- Seed IDs and test scenarios documented consistently

---

## Anti-Patterns

Avoid:

- Leaving default framework README untouched
- Partial API docs that cover only Part 0
- Copy-paste examples not matching actual DTOs

---

## Expected Outcome

After applying this skill:

- Reviewers can run and validate the project quickly
- Deliverables checklist is satisfied
- AI agents get reliable context for future changes
