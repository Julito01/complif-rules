---
name: rule-evaluation-flow
description: Defines the deterministic flow used to evaluate transactions against rules in Part 1.
---

# Rule Evaluation Flow

## Overview

This skill defines the **exact sequence** used to evaluate a transaction
against the rule engine.

Evaluation must be deterministic and explainable.

---

## Evaluation Steps

1. Receive a transaction
2. Load all active rule versions
3. For each rule version:
   - Compute required aggregations
   - Evaluate predicates
4. Produce an evaluation result

---

## Evaluation Result

An Evaluation Result must include:

- Final decision (ALLOW / REVIEW / BLOCK)
- Triggered rules
- Metrics used during evaluation

---

## Design Rules

- Evaluation is stateless
- Evaluation has no side effects
- All decisions must be traceable

Never short-circuit without recording why.

---

## Expected Outcome

After applying this skill:

- Rule evaluation is consistent
- Decisions are auditable
- Debugging is straightforward
