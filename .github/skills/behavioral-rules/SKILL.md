---
name: behavioral-rules
description: Implements behavioral pattern detection rules that identify deviations from an account's historical transaction patterns.
---

# Behavioral Compliance Rules

## Overview

This skill governs implementation of behavioral compliance logic that detects unusual
transaction behavior relative to account history.

It complements structural rules (thresholds and aggregations) by introducing baseline
comparison and deviation facts that can be consumed by rule versions.

---

## When to Use

Use this skill when:

- Adding behavior-based detection to the Part 1 rule engine
- Computing account historical baselines and anomaly indicators
- Exposing deviation facts in the evaluator context
- Designing configurable lookback periods for behavioral analysis
- Testing unusual behavior scenarios in unit/e2e suites

---

## Key Concepts

- **Behavioral Baseline**: Historical profile of an account (amount, frequency, countries, channels)
- **Lookback Window**: Configurable historical interval used to compute baseline data
- **Deviation Fact**: Numeric or boolean indicator comparing current transaction to baseline
- **Cold Start**: Initial state where account history is insufficient for robust baseline inference
- **Behavioral Predicate**: Rule condition that evaluates deviation facts (for example `deviation.amount > 2.0`)

---

## Guidelines

- Implement a behavioral fact provider in the application layer that computes baseline metrics per account
- Compute baseline metrics deterministically from persisted transaction history and event timestamps
- Include at least: average amount, average transaction frequency, typical countries, typical channels
- Expose deviation values in the evaluator fact context using stable, documented field names
- Support configurable lookback duration through rule/window configuration or module config
- Handle cold-start accounts explicitly with deterministic defaults
- Add focused tests for behavioral passes/failures and boundary conditions

### Explicitly Forbidden

- Using non-deterministic or externally mutable signals during evaluation
- Applying ML models or probabilistic scoring not requested by the challenge scope
- Overwriting or mutating source transactions to store behavioral state
- Coupling behavioral calculations to controller-layer DTOs
- Breaking existing structural rule behavior

---

## Design Rules

- Preserve stateless evaluation: behavioral facts are computed at evaluation time from source-of-truth data
- Keep behavioral logic in Part 1 domain/application boundaries, not in infrastructure controllers
- Use explicit naming conventions for facts (for example `deviation.amountRatio`, `behavior.isNewCountry`)
- Prefer additive design: existing condition tree and evaluator interfaces SHOULD remain compatible
- Keep performance bounded by indexed queries and scoped windows per account
- Document fallback behavior for missing history and sparse data

---

## Expected Outcome

After applying this skill:

- Behavioral patterns are evaluated as first-class rule inputs
- Rule versions can trigger on anomalous account behavior, not only static thresholds
- Behavioral logic remains deterministic, testable, and explainable
- The behavioral-rules challenge requirement is covered end-to-end
