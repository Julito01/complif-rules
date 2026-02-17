---
name: alert-deduplication
description: Fixes alert deduplication to prevent duplicate alerts for the same account+rule within a sliding time window.
---

# Alert Deduplication by Window

## Overview

This skill defines meaningful alert deduplication for compliance evaluation so repeated
triggers of the same rule on the same account within a window do not create duplicate alerts.

It replaces trivial per-evaluation deduplication with a business-relevant dedup key based on
account, rule version, and window scope.

---

## When to Use

Use this skill when:

- Refactoring alert creation logic in Part 1
- Changing alert uniqueness constraints and indexes
- Implementing window-aware alert suppression
- Defining active alert checks for duplicate prevention
- Adding tests for repeated triggers in the same window

---

## Key Concepts

- **Dedup Key**: Stable key derived from `idAccount + idRuleVersion + windowStart`
- **Window Start**: Deterministic boundary for the applicable sliding window of a trigger
- **Active Alert**: Alert not resolved/closed and eligible for dedup suppression
- **Duplicate Trigger**: New trigger event matching an existing active alert for the same dedup key
- **Alert Consolidation**: Optional enrichment of existing alert metadata instead of creating a new alert

---

## Guidelines

- Add explicit `dedupKey` field to the alert model and persist it on creation
- Build dedup logic around `(idAccount, idRuleVersion, windowStart)` semantics
- Before creating an alert, check for existing active alert with the same dedup key
- If duplicate is found, skip creation or update existing alert metadata according to policy
- Ensure dedup works across multiple evaluation results within the same window
- Add database uniqueness/index strategy aligned to dedup behavior
- Add e2e coverage for repeated triggers in-window and across window boundaries

### Explicitly Forbidden

- Relying only on `UNIQUE(idEvaluationResult, idRuleVersion)` as dedup strategy
- Creating one new alert per transaction trigger regardless of existing active alerts
- Using non-deterministic wall-clock logic when computing window boundaries
- Merging alerts across different accounts or rule versions
- Silent dedup without auditability or traceability

---

## Design Rules

- Compute `windowStart` using evaluation timestamp and rule window definition deterministically
- Keep dedup decisions in application/domain services, not controllers
- Preserve full evaluation history even when alert creation is suppressed
- Keep alert lifecycle states explicit (`OPEN`, `RESOLVED`, etc.) and use them in active checks
- Ensure dedup implementation remains organization-scoped and multi-tenant safe
- Preserve backward compatibility for alert API contracts where possible

---

## Expected Outcome

After applying this skill:

- Duplicate alerts are suppressed within the same account-rule-window scope
- Alert volume reflects meaningful incidents rather than repeated noise
- Evaluation history remains intact and auditable
- The alert deduplication requirement is satisfied at business granularity
