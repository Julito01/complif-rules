---
name: signature-schema-modeler
description: Designs and maintains the data model for signature schemas in Part 0, including faculties, groups, and authorization rules.
---

# Signature Schema Modeling

## Overview

This skill focuses on the **static configuration layer** of Part 0:
how signature schemas, groups, faculties, and authorization rules are modeled
and stored.

Schemas define _what is allowed_ — not _what is happening now_.

---

## When to Use

Use this skill when:

- Designing database tables or entities for signature schemas
- Creating or modifying schema migrations
- Adding new faculties or authorization rules
- Reasoning about multi-tenant schema configuration

---

## Guidelines

- Signature schemas MUST be configuration, not runtime state
- Schema changes MUST NOT affect already-created signature requests
- Multi-tenant ownership (e.g. organization/account) MUST be explicit
- Faculties SHOULD be enumerable and reusable across accounts

### Forbidden

- Modifying schema structure during signature execution
- Embedding runtime state inside schemas
- Encoding compliance logic into schemas

---

## Modeling Advice

- Separate schema entities from signature request entities
- Prefer explicit tables/objects over JSON blobs
- Favor readability over extreme normalization

---

## Example

User: “Add a new faculty requiring 2 directors and 1 compliance signer.”
Assistant: Extend schema configuration without impacting existing requests.
