---
name: ddd-part-1
description: Applies Domain-Driven Design principles when implementing Part 1 (Rule Engine & Compliance), focusing on event-based evaluation and clear bounded contexts.
---

# Domain-Driven Design for Part 1 – Rule Engine & Compliance

## Overview

This skill ensures that **Part 1 (Rule Engine & Compliance)** is implemented
using **Domain-Driven Design principles**, with a strong focus on:

- Event-based reasoning
- Deterministic rule evaluation
- Auditability and explainability

Part 1 is fundamentally different from Part 0 and MUST be treated as a
separate bounded context.

---

## Bounded Context

Part 1 defines a **new bounded context**:  
**Compliance / Risk Evaluation**

This context is responsible for:

- Evaluating transactions
- Applying compliance and risk rules
- Producing decisions and signals

It is NOT responsible for:

- Mutating accounts
- Managing signature schemas
- Enforcing authorization workflows

Integration with Part 0 happens via **read-only references** (e.g. account risk score).

---

## Core Domain Concepts

Use these terms consistently:

- Transaction
- Rule Template
- Rule Version
- Aggregation
- Sliding Window
- Evaluation Result
- Decision (ALLOW / REVIEW / BLOCK)

If terminology feels ambiguous, stop and clarify the business meaning first.

---

## Aggregates & Consistency

- **Rule Version** SHOULD be treated as an Aggregate Root
- Rule versions are **immutable**
- Transactions are **immutable events**

Never allow partial updates or in-place mutations of these concepts.

---

## Entities vs Value Objects

- **Entities**
  - RuleVersion
  - RuleTemplate (identity-based)

- **Value Objects**
  - Window (e.g. 24h, 7d)
  - Threshold
  - Predicate
  - AggregationResult

Prefer immutability wherever possible.

---

## What DDD Means Here

DDD in Part 1 means:

- Explicit domain modeling
- Clear separation between rules and execution
- Business logic in the domain layer

DDD does NOT mean:

- Event sourcing
- CQRS
- Complex workflow engines
- Distributed messaging

Keep it pragmatic and focused on the challenge requirements.

---

## Expected Outcome

After applying this skill:

- The rule engine is conceptually clean
- Domain logic is explicit and testable
- Part 1 can evolve independently from Part 0
