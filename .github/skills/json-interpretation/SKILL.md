---
name: json-interpretation
description: Explains how to interpret the JSON examples provided in Part 1 without confusing them with the domain model.
---

# JSON Interpretation for Part 1

## Overview

This skill clarifies how to read the JSON examples provided in Part 1
of the challenge.

The JSON is an **input payload**, not a domain model.

---

## Key Insight

The JSON represents:

- A transaction being evaluated
- Contextual information for rule execution

It does NOT represent:

- Database schema
- Domain aggregates
- Rule definitions

---

## Mapping Guidance

- JSON → Transaction (Value Object)
- Rule references → Rule Versions
- Output → Evaluation Result

Do not shape your domain model around the JSON structure.

---

## Anti-Patterns

Avoid:

- Designing entities directly from JSON
- Treating JSON as persistence schema
- Hardcoding rule logic based on example payloads

---

## Expected Outcome

After applying this skill:

- Domain models remain clean
- JSON handling is isolated
- The system remains evolvable
