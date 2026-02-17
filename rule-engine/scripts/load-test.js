/**
 * k6 Load Test Script — Complif Transaction Evaluation
 *
 * Purpose:
 *   Verify non-functional requirements:
 *     - p99 latency < 100ms
 *     - Sustained throughput ≥ 50 txn/sec
 *
 * Prerequisites:
 *   1. Install k6: brew install k6
 *   2. Start the API: cd rule-engine && docker compose up -d && npm run start
 *   3. Seed data: curl -X POST http://localhost:3000/seed
 *
 * Run:
 *   k6 run scripts/load-test.js
 *
 * Environment variables:
 *   BASE_URL  — API base URL (default: http://localhost:3000)
 *   DURATION  — Test duration (default: 60s)
 *   VUS       — Virtual users / concurrency (default: 10)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const evaluationLatency = new Trend('evaluation_latency_ms', true);
const failureRate = new Rate('failure_rate');

// Test configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ACCOUNT_ID = '00000000-0000-4000-a000-000000000001';
const ORG_ID = 'complif-001';

export const options = {
  stages: [
    { duration: '10s', target: 20 }, // Warm-up: ramp to 20 VUs
    { duration: __ENV.DURATION || '60s', target: parseInt(__ENV.VUS) || 20 }, // Sustained load
    { duration: '5s', target: 0 }, // Cool-down
  ],
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    // Challenge NFR gates — test FAILS if these are not met
    evaluation_latency_ms: ['p(99)<100'], // Server-side eval p99 < 100ms
    http_reqs: ['rate>=50'], // Sustained throughput >= 50 txn/sec
    failure_rate: ['rate<0.01'], // <1% error rate
  },
};

// Transaction types and amounts for realistic distribution
const TX_TYPES = ['CASH_IN', 'CASH_OUT', 'DEBIT', 'CREDIT', 'TRANSFER'];
const CURRENCIES = ['USD', 'EUR', 'BRL', 'GBP'];
const CHANNELS = ['WEB', 'MOBILE', 'ATM', 'BRANCH'];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function () {
  // Build a realistic transaction payload
  const payload = JSON.stringify({
    idAccount: ACCOUNT_ID,
    type: randomElement(TX_TYPES),
    amount: Math.floor(Math.random() * 50000) + 100,
    currency: randomElement(CURRENCIES),
    datetime: new Date().toISOString(),
    channel: randomElement(CHANNELS),
    country: 'US',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-organization-id': ORG_ID,
      'X-Request-ID': `k6-${__VU}-${__ITER}-${Date.now()}`,
    },
    tags: { name: 'ingest' },
  };

  const res = http.post(`${BASE_URL}/transactions`, payload, params);

  // Track success/failure
  const success = check(res, {
    'status is 201': (r) => r.status === 201,
    'has evaluation decision': (r) => {
      try {
        const body = JSON.parse(r.body);
        return ['ALLOW', 'REVIEW', 'BLOCK'].includes(body?.data?.evaluation?.decision);
      } catch {
        return false;
      }
    },
  });

  failureRate.add(!success);

  // Extract evaluation duration from response for accurate server-side latency
  try {
    const body = JSON.parse(res.body);
    const durationMs = body?.data?.evaluation?.evaluationDurationMs;
    if (typeof durationMs === 'number') {
      evaluationLatency.add(durationMs);
    }
  } catch {
    // Ignore parse errors
  }

  // ~50+ txn/sec with 10 VUs → each VU should do ~5 txn/sec → ~200ms between requests
  sleep(0.1 + Math.random() * 0.1);
}

export function handleSummary(data) {
  // Print a readable summary
  const p99 = data.metrics?.evaluation_latency_ms?.values?.['p(99)'] || 'N/A';
  const p95 = data.metrics?.evaluation_latency_ms?.values?.['p(95)'] || 'N/A';
  const p50 =
    data.metrics?.evaluation_latency_ms?.values?.['p(50)'] ||
    data.metrics?.evaluation_latency_ms?.values?.med ||
    'N/A';
  const httpP99 = data.metrics?.['http_req_duration{name:ingest}']?.values?.['p(99)'] || 'N/A';
  const totalReqs = data.metrics?.http_reqs?.values?.count || 0;
  const duration = data.state?.testRunDurationMs / 1000 || 1;
  const throughput = (totalReqs / duration).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('  COMPLIF LOAD TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`  Total requests:    ${totalReqs}`);
  console.log(`  Duration:          ${duration.toFixed(1)}s`);
  console.log(`  Throughput:        ${throughput} txn/sec`);
  console.log(`  Eval latency p50:  ${typeof p50 === 'number' ? p50.toFixed(1) : p50}ms`);
  console.log(`  Eval latency p95:  ${typeof p95 === 'number' ? p95.toFixed(1) : p95}ms`);
  console.log(`  Eval latency p99:  ${typeof p99 === 'number' ? p99.toFixed(1) : p99}ms`);
  console.log(
    `  HTTP ingest p99:   ${typeof httpP99 === 'number' ? httpP99.toFixed(1) : httpP99}ms`,
  );
  console.log(`  Target p99:        < 100ms`);
  console.log(`  Target throughput: >= 50 txn/sec`);
  console.log('='.repeat(60));

  // Return JSON report for auditing
  return {
    'scripts/load-test-results.json': JSON.stringify(data, null, 2),
  };
}
