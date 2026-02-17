---
name: aggregations-and-windows
description: Guides the correct implementation of aggregations and sliding time windows for transaction evaluation.
---

# Aggregations & Sliding Windows (Part 1)

## Overview

This skill explains how **aggregations over sliding windows** work in the
context of compliance and risk evaluation.

This is the core technical challenge of Part 1.

---

## Key Concepts

- Transactions are immutable events
- Aggregations are computed at evaluation time
- Windows are based on event timestamps, not system time

Examples of aggregations:

- Count of transactions in the last 24h
- Sum of amounts in the last 7d
- Unique countries used in the last 30d

---

## Sliding Windows

A sliding window:

- Is defined by a duration (e.g. 24h, 7d)
- Is anchored to the transaction being evaluated
- Includes only past transactions

Never use wall-clock `now()` for evaluation logic.

---

## Design Rules

- Aggregations MUST be deterministic
- Aggregations MUST be reproducible
- Aggregations MUST NOT be stored as rolling state

Each evaluation recomputes what it needs.

---

## Anti-Patterns

Avoid:

- Precomputing counters on accounts
- Background jobs to maintain aggregates
- Storing derived metrics as source of truth

---

## Expected Outcome

After applying this skill:

- Aggregations are correct and explainable
- Time-based logic is predictable
- Historical evaluations remain valid
