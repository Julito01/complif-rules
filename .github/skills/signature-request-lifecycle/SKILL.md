---
name: signature-request-lifecycle
description: Manages the lifecycle and state transitions of signature requests in Part 0.
---

# Signature Request Lifecycle

## Overview

This skill governs how signature requests are created, updated,
and transitioned between states.

Signature requests represent **runtime authorization workflows**.

---

## When to Use

Use this skill when:

- Creating signature requests
- Handling new signatures
- Transitioning request states
- Validating request status

---

## Valid States

- CREATED
- IN_PROGRESS
- COMPLETED
- REJECTED
- CANCELLED
- EXPIRED

---

## Guidelines

- State transitions MUST be explicit
- COMPLETED is a terminal state
- Collected signatures MUST be immutable once completed
- Every state change SHOULD be auditable

### Forbidden

- Implicit or hidden state changes
- Retroactive modification of signatures
- Triggering compliance or transaction execution

---

## Example

User: “What happens when the last required signer signs?”
Assistant: Transition request to COMPLETED and emit a completion event.
