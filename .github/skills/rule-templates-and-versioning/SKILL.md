---
name: rule-templates-and-versioning
description: Enforces a clear separation between rule templates and immutable rule versions in Part 1.
---

# Rule Templates & Versioning

## Overview

This skill explains how rules should be modeled so they are:

- Reusable
- Immutable
- Auditable

This is critical for compliance systems.

---

## Rule Templates

A Rule Template:

- Defines the structure of a rule
- Is parameterized
- Is NOT executable on its own

Examples:

- "More than X transactions in Y window"
- "Total amount over threshold in window"

---

## Rule Versions

A Rule Version:

- Is an immutable snapshot
- Has concrete parameters
- Has an activation time

Only Rule Versions are evaluated.

---

## Design Rules

- Never mutate an existing rule version
- Never overwrite historical definitions
- Always create a new version for changes

Old versions must remain evaluable for historical transactions.

---

## Anti-Patterns

Avoid:

- Updating rules in place
- Mixing templates with execution logic
- Deleting old rule definitions

---

## Expected Outcome

After applying this skill:

- Rule behavior is predictable
- Historical decisions are explainable
- Audits are possible
