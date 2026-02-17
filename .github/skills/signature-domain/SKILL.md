---
name: signature-domain
description: Implements the Signature & Authorization domain (Part 0). Use this skill when working on signature schemas, authorization rules, or signature request lifecycle.
---

# Signature & Authorization Domain (Part 0)

## Overview

This skill governs **Part 0 of the backend challenge**: modeling and implementing
human authorization workflows required to perform sensitive actions on an account.

This domain answers:
“Who is allowed to authorize this action, and under which combinations?”

It is strictly deterministic and independent from compliance or risk evaluation.

---

## When to Use

Use this skill when:

- Implementing or modifying signature schemas
- Implementing authorization rules
- Implementing signature request lifecycle
- Answering questions about how authorization works in Part 0
- Designing entities related to signers, groups, faculties, or schemas

---

## Domain Concepts (use these names consistently)

- **Account**: Entity that owns signature schemas
- **Faculty**: A capability that requires authorization (e.g. APPROVE_WIRE)
- **Signer**: A human or legal representative who can sign
- **Group**: Logical grouping of signers (A, B, C, etc.)
- **Signature Schema**: Configuration defining authorization rules per faculty
- **Signature Rule**: One valid signer combination
- **Signature Request**: Runtime instance tracking collected signatures

Do not invent new core concepts without strong justification.

---

## Guidelines

- Authorization logic MUST be deterministic
- Signature schemas MUST be treated as immutable configuration
- Signature requests MUST have explicit state transitions
- A COMPLETED signature request is final and auditable

### Explicitly Forbidden

- Implementing compliance, fraud, or risk logic
- Updating account risk scores
- Using probabilistic or heuristic logic
- Depending on Part 1 rule engine logic

---

## Boundary with Part 1

This domain MAY emit an immutable event when a signature request is completed.
It MUST NOT evaluate compliance rules or transaction risk.

---

## Example

User: “Can this set of signers approve a wire?”
Assistant: Evaluate the signature request against the schema’s authorization rules and return COMPLETED or IN_PROGRESS.
