---
name: signature-combinatorics
description: Evaluates whether collected signatures satisfy authorization rules defined in a signature schema.
---

# Authorization Combinatorics Engine

## Overview

This skill implements the logic that determines whether a set of collected
signatures satisfies **at least one** authorization rule for a faculty.

The output is strictly boolean and deterministic.

---

## When to Use

Use this skill when:

- Evaluating whether a signature request is completed
- Implementing rule-matching logic
- Writing unit tests for authorization combinations

---

## Guidelines

- AND / OR combinations MUST be supported
- Multiple valid combinations MUST be supported
- Evaluation MUST short-circuit on the first valid rule
- Output MUST be deterministic and side-effect free

### Forbidden

- Time-based logic
- Probabilistic scoring
- Side effects or state mutation
- Compliance or risk reasoning

---

## Evaluation Model

1. Count signatures per group
2. Evaluate each authorization rule independently
3. If one rule matches → authorization succeeds
4. Otherwise → request remains incomplete

---

## Example

User: “Does 1A + 1B + 2C satisfy this request?”
Assistant: Compare group counts against schema-defined combinations.
