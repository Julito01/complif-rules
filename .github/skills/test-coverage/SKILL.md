---
name: test-coverage
description: Ensures test coverage exceeds 80% across all modules with coverage reporting configured.
---

# Coverage Enforcement for Critical Modules

## Overview

This skill governs coverage configuration and test expansion required to verify that
critical modules exceed the challenge coverage threshold.

It formalizes measurement, thresholds, and remediation so coverage quality is enforced
instead of estimated.

---

## When to Use

Use this skill when:

- Enabling and configuring Jest coverage reporting
- Defining repository coverage thresholds
- Identifying low-coverage critical modules
- Adding tests to close coverage gaps
- Reporting final coverage evidence in documentation

---

## Key Concepts

- **Coverage Threshold**: Minimum branch/function/line/statement percentage required
- **Critical Module**: Core business modules (signature + compliance rule engine paths)
- **Coverage Report**: Jest output (text/lcov/json-summary) used for validation
- **Exclusion Policy**: Explicit ignore patterns for non-critical/generated/bootstrap files
- **Quality Gate**: Build/test failure when coverage drops below threshold

---

## Guidelines

- Enable Jest `collectCoverage` and generate machine-readable and human-readable reports
- Set `coverageThreshold` to at least 80% for branches, functions, lines, and statements where required
- Define `coveragePathIgnorePatterns` for known non-critical files (for example `main.ts`, migrations, test helpers)
- Run coverage and identify modules below threshold before adding new tests
- Add targeted unit/e2e tests for uncovered critical logic paths and edge cases
- Keep tests deterministic and aligned with existing DDD boundaries
- Document final coverage numbers and command used to reproduce results

### Explicitly Forbidden

- Inflating coverage via meaningless assertions or trivial tests
- Lowering thresholds to pass without stakeholder approval
- Excluding core domain/application modules to game the metric
- Treating `--no-coverage` runs as evidence of compliance
- Modifying production logic solely to simplify test writing

---

## Design Rules

- Prioritize coverage in domain and application services that implement business decisions
- Preserve existing test architecture and naming conventions in the repository
- Add tests where behavior risk is highest (rule evaluation, deduplication, lifecycle transitions)
- Keep fixture/seeding strategy reusable and maintainable
- Ensure coverage checks can run locally and in CI with the same command semantics
- Report coverage deltas after major feature additions to avoid regressions

---

## Expected Outcome

After applying this skill:

- Coverage reporting is enabled and reproducible
- Critical modules meet or exceed 80% coverage threshold
- Gaps are closed with meaningful tests, not metric gaming
- Coverage compliance is auditable and continuously enforceable
