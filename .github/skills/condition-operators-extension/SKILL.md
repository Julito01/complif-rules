---
name: condition-operators-extension
description: Adds missing low-effort condition features for Part 1: NOT combinator, between operator, and regex operator.
---

# Condition Operators Extension (Part 1)

## Overview

Use this skill to close the low-effort logic gaps in the condition evaluator:

- NOT combinator
- `between` operator
- `regex` operator

Keep the evaluator pure and deterministic.

---

## When to Use

Use this skill when:

- Extending `ConditionNode` tree structure
- Adding new operators to evaluator maps
- Improving JSON condition expressiveness
- Writing edge-case tests for predicates

---

## Required Behavior

### 1) NOT combinator

Support negating any subtree.

Example:

```json
{
  "not": {
    "all": [{ "fact": "transaction.country", "operator": "in", "value": ["AR", "UY"] }]
  }
}
```

### 2) between

`between` evaluates inclusive numeric ranges by default:

- expected format: `[min, max]`
- true when `min <= fact <= max`

### 3) regex

`regex` matches string facts with a valid regular expression pattern.

- invalid regex pattern must fail safely (deterministic false or controlled error)
- non-string facts should return false

---

## Implementation Rules

- Preserve current semantics for `all`/`any` and existing operators
- Do not add side effects to domain service
- Keep behavior predictable for null/undefined facts
- Keep backward compatibility for existing rules

---

## Test Requirements

Add tests for:

- NOT with leaf predicates
- NOT wrapping nested `all`/`any`
- `between` happy path + boundary values + invalid input shape
- `regex` happy path + non-string fact + invalid pattern

Do not weaken existing tests; all current specs should pass.

---

## Anti-Patterns

Avoid:

- Ambiguous `between` semantics
- Throwing unhandled regex construction errors
- Coupling operator logic to transport DTOs

---

## Expected Outcome

After applying this skill:

- Rule JSON supports required logical expressiveness
- Evaluator remains deterministic and auditable
- Part 1 condition coverage better matches the challenge
