import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

/**
 * Prometheus Metrics Service — Exposes application metrics for observability.
 *
 * Tracks:
 *  - Transaction evaluation latency (histogram)
 *  - Transaction throughput (counter)
 *  - Evaluation decisions breakdown (counter by decision)
 *  - Alert generation (counter by severity)
 *  - Active rules gauge
 *  - Cache hit/miss counters
 *  - WebSocket connected clients gauge
 *
 * Scraped at GET /metrics in Prometheus exposition format.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly register: client.Registry;

  // ─── Histograms ──────────────────────────────────────────────────
  readonly evaluationDuration: client.Histogram;

  // ─── Counters ────────────────────────────────────────────────────
  readonly transactionsTotal: client.Counter;
  readonly evaluationDecisions: client.Counter;
  readonly alertsGenerated: client.Counter;
  readonly cacheHits: client.Counter;
  readonly cacheMisses: client.Counter;
  readonly httpRequestsTotal: client.Counter;

  // ─── Gauges ──────────────────────────────────────────────────────
  readonly activeRules: client.Gauge;
  readonly wsConnections: client.Gauge;

  constructor() {
    this.register = new client.Registry();

    // Default Node.js metrics (event loop, memory, CPU)
    client.collectDefaultMetrics({ register: this.register, prefix: 'complif_' });

    this.evaluationDuration = new client.Histogram({
      name: 'complif_evaluation_duration_ms',
      help: 'Transaction evaluation duration in milliseconds',
      labelNames: ['decision', 'organization'] as const,
      buckets: [5, 10, 25, 50, 75, 100, 250, 500, 1000],
      registers: [this.register],
    });

    this.transactionsTotal = new client.Counter({
      name: 'complif_transactions_total',
      help: 'Total number of transactions ingested',
      labelNames: ['organization', 'type'] as const,
      registers: [this.register],
    });

    this.evaluationDecisions = new client.Counter({
      name: 'complif_evaluation_decisions_total',
      help: 'Total evaluation decisions by type',
      labelNames: ['decision', 'organization'] as const,
      registers: [this.register],
    });

    this.alertsGenerated = new client.Counter({
      name: 'complif_alerts_generated_total',
      help: 'Total alerts generated',
      labelNames: ['severity', 'category', 'organization'] as const,
      registers: [this.register],
    });

    this.cacheHits = new client.Counter({
      name: 'complif_cache_hits_total',
      help: 'Total cache hits',
      labelNames: ['cache_type'] as const,
      registers: [this.register],
    });

    this.cacheMisses = new client.Counter({
      name: 'complif_cache_misses_total',
      help: 'Total cache misses',
      labelNames: ['cache_type'] as const,
      registers: [this.register],
    });

    this.httpRequestsTotal = new client.Counter({
      name: 'complif_http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'] as const,
      registers: [this.register],
    });

    this.activeRules = new client.Gauge({
      name: 'complif_active_rules',
      help: 'Number of active rule versions',
      labelNames: ['organization'] as const,
      registers: [this.register],
    });

    this.wsConnections = new client.Gauge({
      name: 'complif_ws_connections',
      help: 'Number of active WebSocket connections',
      registers: [this.register],
    });
  }

  async onModuleInit(): Promise<void> {
    // Registry is ready on construction
  }

  /**
   * Record a transaction evaluation.
   */
  recordEvaluation(
    organizationId: string,
    decision: string,
    durationMs: number,
    transactionType: string,
  ): void {
    this.evaluationDuration.observe({ decision, organization: organizationId }, durationMs);
    this.transactionsTotal.inc({ organization: organizationId, type: transactionType });
    this.evaluationDecisions.inc({ decision, organization: organizationId });
  }

  /**
   * Record an alert generation.
   */
  recordAlert(organizationId: string, severity: string, category: string): void {
    this.alertsGenerated.inc({ severity, category, organization: organizationId });
  }

  /**
   * Record a cache operation.
   */
  recordCacheHit(cacheType: string): void {
    this.cacheHits.inc({ cache_type: cacheType });
  }

  recordCacheMiss(cacheType: string): void {
    this.cacheMisses.inc({ cache_type: cacheType });
  }

  /**
   * Set active rules count for an organization.
   */
  setActiveRulesCount(organizationId: string, count: number): void {
    this.activeRules.set({ organization: organizationId }, count);
  }

  /**
   * Get all metrics in Prometheus text format.
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Get content type for Prometheus scraping.
   */
  getContentType(): string {
    return this.register.contentType;
  }
}
