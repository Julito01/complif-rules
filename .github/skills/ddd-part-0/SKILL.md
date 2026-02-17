---
name: ddd-part-0
description: Applies Domain-Driven Design principles when implementing Part 0 (Signature & Authorization), focusing on clear domain boundaries without overengineering.
---

# Domain-Driven Design for Part 0

## Overview

This skill ensures that **Part 0 (Signature & Authorization)** is implemented
using **Domain-Driven Design principles**, with a focus on clarity, correctness,
and explicit domain modeling.

DDD is used here as a **structuring and reasoning tool**, not as an excuse
for unnecessary complexity.

---

## When to Use

Use this skill when:

- Designing the overall structure of Part 0
- Creating domain entities, value objects, or aggregates
- Deciding where business rules should live
- Separating domain logic from infrastructure
- Naming classes, modules, or folders

---

## Core DDD Principles to Apply

### Bounded Context

- Part 0 is a **single bounded context**: _Signature & Authorization_
- Concepts from Part 1 (Rule Engine, Compliance, Risk) MUST NOT leak in
- Integration with other contexts MUST happen via events or read-only projections

---

### Ubiquitous Language

Use domain terms consistently:

- Account
- Faculty
- Group
- Signer
- Signature Schema
- Signature Rule
- Signature Request

If a name feels ambiguous, stop and clarify the domain meaning first.

---

### Aggregates & Consistency

- **Signature Request** SHOULD be treated as an Aggregate Root
- Authorization rules MUST be enforced inside the aggregate
- External code MUST NOT partially modify aggregate state

Keep invariants inside the aggregate boundary.

---

### Entities vs Value Objects

- Use **Entities** for objects with identity (e.g. SignatureRequest, Signer)
- Use **Value Objects** for immutable concepts (e.g. GroupCount, Faculty)

Prefer immutability where possible.

---

## Pragmatism Rules (Very Important)

- Do NOT introduce patterns unless they solve a real problem
- Repositories are allowed, but should be thin
- Domain services are allowed only when logic does not fit an entity naturally
- Avoid over-abstraction and excessive indirection

This is a coding challenge, not a framework demo.

---

## What DDD Does NOT Mean Here

DDD in this project does NOT mean:

- Event sourcing
- CQRS
- Complex messaging infrastructure
- Dozens of aggregates or services

Those are explicitly out of scope unless required by the challenge.

---

## Example

User: “Where should the logic to check if a request is completed live?”
Assistant: Inside the SignatureRequest aggregate, since it enforces core invariants.

User: “Should the rule engine logic be reused here?”
Assistant: No. Part 0 and Part 1 are separate bounded contexts.

---

## Expected Outcome

After applying this skill:

- Domain logic is readable and explicit
- Business rules are easy to locate
- Part 0 can evolve independently from Part 1
- The model matches the business language of the challenge
