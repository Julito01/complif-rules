---
name: performance-metrics
description: Exposes performance metrics endpoint and implements load testing to verify p99 < 100ms and 50 txn/sec throughput NFRs.
---

# Performance Metrics and Load Verification

## Overview

This skill defines how to expose measurable performance indicators and verify non-functional
requirements through repeatable load testing.

It focuses on proving, not assuming, that transaction evaluation meets p99 latency and
throughput targets from the challenge specification.

---

## When to Use

Use this skill when:

- Implementing a metrics endpoint for runtime performance visibility
- Computing latency percentiles from evaluation results
- Measuring sustained throughput under load
- Creating reproducible load-test scripts and acceptance checks
- Documenting evidence that NFR targets are met

---

## Key Concepts

- **Latency Percentiles**: p50/p95/p99 computed from `evaluationDurationMs`
- **Throughput**: Transactions processed per second over a measurement interval
- **Metrics Endpoint**: API route exposing operational counters and latency statistics
- **Load Test Scenario**: Controlled traffic profile (for example 50+ txn/sec for 60s)
- **Acceptance Gate**: Explicit pass/fail criteria aligned to NFR thresholds

---

## Guidelines

- Implement `GET /metrics` (or `GET /health/metrics`) returning JSON with p50/p95/p99 latency and throughput
- Include at minimum: active rule count and alert count in the metrics payload
- Compute metrics from persisted evaluation data using deterministic query windows
- Add load test script using k6 or Artillery under `scripts/` with documented execution steps
- Configure load test to sustain at least 50 txn/sec for at least 60 seconds
- Add explicit assertion/check for p99 latency below 100ms during test run
- Document baseline hardware/environment assumptions for fair interpretation

### Explicitly Forbidden

- Claiming NFR compliance without measured evidence
- Using one-off manual checks without reproducible script
- Mixing warm-up and measurement windows without clear separation
- Reporting averages only when percentile requirement is p99
- Hardcoding fake metric values in endpoint responses

---

## Design Rules

- Keep metrics read path efficient and index-aware for production-like usage
- Maintain clear separation between business evaluation logic and observability layer
- Prefer additive API design: metrics endpoint MUST NOT break existing endpoints
- Time windows for metric computation SHOULD be configurable
- Load scripts SHOULD be deterministic enough for repeated CI/local comparison
- Store and share test outputs as auditable evidence of compliance

---

## Expected Outcome

After applying this skill:

- Performance metrics are available via API for real-time inspection
- Load tests can be run repeatably from the repository
- p99 latency and throughput targets are verified with evidence
- Performance non-functional requirements are objectively validated
