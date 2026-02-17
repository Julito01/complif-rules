import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Transaction, RuleVersion, EvaluationResult, Alert } from '../domain';
import { ComplianceListService } from './compliance-list.service';
import { BehavioralBaselineService } from './behavioral-baseline.service';
import { RedisCacheService } from '../../../shared/cache';
import { ConditionNode } from '../domain/value-objects/condition-node.vo';
import { ActionDefinition } from '../domain/value-objects/action-definition.vo';
import { WindowSpec } from '../domain/value-objects/window-spec.vo';
import { WindowCalculator } from '../domain/services/window-calculator.service';
import {
  TransactionEvaluationEngine,
  RuleVersionForEval,
} from '../domain/services/transaction-evaluation-engine.service';
import { EvaluationResultVO } from '../domain/value-objects/evaluation-result.vo';
import { EvaluationGateway } from '../infrastructure/gateways/evaluation.gateway';
import { MetricsService } from '../../../shared/metrics';

export interface IngestTransactionInput {
  idOrganization: string;
  idAccount: string;
  type: string;
  subType?: string;
  amount: number;
  currency: string;
  amountNormalized?: number;
  currencyNormalized?: string;
  datetime: Date;
  date?: string;
  country?: string;
  counterpartyId?: string;
  channel?: string;
  quantity?: number;
  asset?: string;
  price?: number;
  isVoided?: boolean;
  isBlocked?: boolean;
  isDeleted?: boolean;
  externalCode?: string;
  data?: Record<string, unknown>;
  origin?: string;
  deviceInfo?: Record<string, unknown>;
  idTransactionLote?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface TransactionEvaluationOutput {
  transaction: Transaction;
  evaluationResult: EvaluationResult;
  alerts: Alert[];
}

/**
 * Transaction Evaluation Service - Application Service
 *
 * Orchestrates the full flow:
 *   1. Persist incoming transaction
 *   2. Load active rule versions
 *   3. For each rule with a window, compute aggregation from historical data
 *   4. Build facts object (transaction + aggregations)
 *   5. Invoke pure domain engine
 *   6. Persist evaluation result
 *   7. Generate alerts for triggered rules with create_alert actions
 *
 * This is the ONLY service that touches both domain logic and persistence.
 */
@Injectable()
export class TransactionEvaluationService {
  private readonly logger = new Logger(TransactionEvaluationService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(RuleVersion)
    private readonly ruleVersionRepository: Repository<RuleVersion>,
    @InjectRepository(EvaluationResult)
    private readonly evaluationResultRepository: Repository<EvaluationResult>,
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    private readonly dataSource: DataSource,
    private readonly complianceListService: ComplianceListService,
    private readonly behavioralBaselineService: BehavioralBaselineService,
    private readonly cacheService: RedisCacheService,
    private readonly evaluationGateway: EvaluationGateway,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Ingest a transaction, evaluate it against all active rules, and persist results.
   * Wrapped in a database transaction for atomicity.
   */
  async ingestAndEvaluate(input: IngestTransactionInput): Promise<TransactionEvaluationOutput> {
    return this.dataSource.transaction(async (manager) => {
      const startTime = Date.now();

      // 1. Persist the transaction
      const transaction = await this.persistTransaction(input, manager);

      // 2. Load active rule versions
      const activeRules = await this.loadActiveRules(input.idOrganization);

      if (activeRules.length === 0) {
        // No rules → ALLOW by default, still record the evaluation
        const evaluationResult = await this.persistEvaluationResult(
          transaction,
          { decision: 'ALLOW', triggeredRules: [], allRuleResults: [], actions: [] },
          startTime,
          manager,
        );
        return { transaction, evaluationResult, alerts: [] };
      }

      // 3. Build facts with aggregations
      const facts = await this.buildFacts(transaction, activeRules);

      // 4. Prepare rules for domain engine
      const rulesForEval: RuleVersionForEval[] = activeRules.map((rv) => ({
        id: rv.id,
        idRuleTemplate: rv.idRuleTemplate,
        versionNumber: rv.versionNumber,
        conditions: rv.conditions as ConditionNode,
        actions: rv.actions as ActionDefinition[],
        priority: rv.priority,
      }));

      // 5. Invoke pure domain evaluation
      const result = TransactionEvaluationEngine.evaluate(rulesForEval, facts);

      // 6. Persist evaluation result
      const evaluationResult = await this.persistEvaluationResult(
        transaction,
        result,
        startTime,
        manager,
      );

      // 7. Generate alerts
      const alerts = await this.generateAlerts(
        transaction,
        evaluationResult,
        result,
        activeRules,
        manager,
      );

      this.logger.log(
        `Transaction ${transaction.id} evaluated: ${result.decision} ` +
          `(${result.triggeredRules.length}/${activeRules.length} rules triggered, ` +
          `${Date.now() - startTime}ms)`,
      );

      // 8. Stream results via WebSocket
      this.emitWebSocketEvents(
        input.idOrganization,
        transaction,
        evaluationResult,
        alerts,
        activeRules.length,
      );

      // 9. Record Prometheus metrics
      this.recordMetrics(
        input.idOrganization,
        result.decision,
        Date.now() - startTime,
        input.type,
        alerts,
        activeRules.length,
      );

      return { transaction, evaluationResult, alerts };
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────

  /**
   * Fire-and-forget WebSocket events for real-time streaming.
   * Errors are swallowed — WebSocket is best-effort, never blocks evaluation.
   */
  private emitWebSocketEvents(
    organizationId: string,
    transaction: Transaction,
    evaluationResult: EvaluationResult,
    alerts: Alert[],
    totalRules: number,
  ): void {
    try {
      this.evaluationGateway.emitEvaluationResult(organizationId, {
        transactionId: transaction.id,
        accountId: transaction.idAccount,
        decision: evaluationResult.decision,
        triggeredRulesCount: Array.isArray(evaluationResult.triggeredRules)
          ? evaluationResult.triggeredRules.length
          : 0,
        totalRulesEvaluated: totalRules,
        evaluationDurationMs: evaluationResult.evaluationDurationMs,
        timestamp: new Date().toISOString(),
      });

      for (const alert of alerts) {
        this.evaluationGateway.emitAlert(organizationId, {
          alertId: alert.id,
          transactionId: transaction.id,
          severity: alert.severity,
          category: alert.category,
          message: alert.message,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // WebSocket emission is best-effort — never fail the evaluation
    }
  }

  /**
   * Record Prometheus metrics for the evaluation. Fire-and-forget.
   */
  private recordMetrics(
    organizationId: string,
    decision: string,
    durationMs: number,
    transactionType: string,
    alerts: Alert[],
    activeRulesCount: number,
  ): void {
    try {
      this.metricsService.recordEvaluation(organizationId, decision, durationMs, transactionType);
      this.metricsService.setActiveRulesCount(organizationId, activeRulesCount);
      for (const alert of alerts) {
        this.metricsService.recordAlert(organizationId, alert.severity, alert.category);
      }
    } catch {
      // Metrics are best-effort
    }
  }

  private async persistTransaction(
    input: IngestTransactionInput,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const repo = manager ? manager.getRepository(Transaction) : this.transactionRepository;
    const transaction = repo.create({
      idOrganization: input.idOrganization,
      idAccount: input.idAccount,
      type: input.type,
      subType: input.subType || null,
      amount: input.amount,
      currency: input.currency,
      amountNormalized: input.amountNormalized ?? input.amount,
      currencyNormalized: input.currencyNormalized ?? 'USD',
      datetime: input.datetime,
      date: input.date || null,
      country: input.country || null,
      counterpartyId: input.counterpartyId || null,
      channel: input.channel || null,
      quantity: input.quantity ?? null,
      asset: input.asset || null,
      price: input.price ?? null,
      isVoided: input.isVoided ?? false,
      isBlocked: input.isBlocked ?? false,
      isDeleted: input.isDeleted ?? false,
      externalCode: input.externalCode || null,
      data: input.data || null,
      origin: input.origin || null,
      deviceInfo: input.deviceInfo || null,
      idTransactionLote: input.idTransactionLote || null,
      metadata: input.metadata || null,
      createdBy: input.createdBy || null,
    });

    return repo.save(transaction);
  }

  private async loadActiveRules(idOrganization: string): Promise<RuleVersion[]> {
    // Try cache first
    const cached = await this.cacheService.getActiveRules<RuleVersion>(idOrganization);
    if (cached) {
      this.logger.debug(`Cache HIT for active rules (org=${idOrganization})`);
      return cached;
    }

    const rules = await this.ruleVersionRepository.find({
      where: {
        idOrganization,
        enabled: true,
        deactivatedAt: IsNull(),
      } as FindOptionsWhere<RuleVersion>,
      order: { priority: 'ASC' },
    });

    // Populate cache
    await this.cacheService.setActiveRules(idOrganization, rules);
    this.logger.debug(`Cache MISS for active rules (org=${idOrganization}, count=${rules.length})`);
    return rules;
  }

  /**
   * Build the facts object for domain evaluation.
   *
   * Structure:
   * {
   *   transaction: { amount, type, country, ... },
   *   aggregation: { count_24h, sum_amount_24h, ... }
   * }
   */
  private async buildFacts(
    transaction: Transaction,
    activeRules: RuleVersion[],
  ): Promise<Record<string, unknown>> {
    // Base transaction facts
    const transactionFacts: Record<string, unknown> = {
      amount: Number(transaction.amount),
      amountNormalized: transaction.amountNormalized ? Number(transaction.amountNormalized) : null,
      type: transaction.type,
      subType: transaction.subType,
      currency: transaction.currency,
      country: transaction.country,
      counterpartyId: transaction.counterpartyId,
      channel: transaction.channel,
      datetime: transaction.datetime.toISOString(),
      date: transaction.date,
      idAccount: transaction.idAccount,
      quantity: transaction.quantity ? Number(transaction.quantity) : null,
      asset: transaction.asset,
      price: transaction.price ? Number(transaction.price) : null,
      isVoided: transaction.isVoided,
      isBlocked: transaction.isBlocked,
      origin: transaction.origin,
      externalCode: transaction.externalCode,
      data: transaction.data,
      deviceInfo: transaction.deviceInfo,
    };

    // Compute aggregations for rules that define a window
    const aggregationFacts: Record<string, unknown> = {};

    // Collect unique windows to avoid duplicate queries
    const windowKeys = new Set<string>();
    const windowsToCompute: Array<{ window: WindowSpec; key: string }> = [];

    for (const rule of activeRules) {
      if (rule.window) {
        const w = rule.window as WindowSpec;
        const key = `${w.duration}_${w.unit}`;
        if (!windowKeys.has(key)) {
          windowKeys.add(key);
          windowsToCompute.push({ window: w, key });
        }
      }
    }

    // Compute all unique window aggregations IN PARALLEL using SQL aggregates
    // (previously: fetched all rows with .getMany() and aggregated in JS)
    const windowPromises = windowsToCompute.map(async ({ window, key }) => {
      const bounds = WindowCalculator.computeWindowBounds(transaction.datetime, window);
      const suffix = key.replaceAll('_', '');

      // Single SQL query with all aggregations — no entity hydration
      const raw = await this.transactionRepository
        .createQueryBuilder('t')
        .select([
          'COUNT(*)::int AS count',
          'COALESCE(SUM(t.amount::numeric), 0)::float AS sum_amount',
          'AVG(t.amount::numeric)::float AS avg_amount',
          'MAX(t.amount::numeric)::float AS max_amount',
          'MIN(t.amount::numeric)::float AS min_amount',
        ])
        .where('t.id_account = :accountId', { accountId: transaction.idAccount })
        .andWhere('t.id_organization = :orgId', { orgId: transaction.idOrganization })
        .andWhere('t.datetime >= :start', { start: bounds.start })
        .andWhere('t.datetime < :end', { end: bounds.end })
        .andWhere('t.id != :currentId', { currentId: transaction.id })
        .getRawOne();

      aggregationFacts[`count_${suffix}`] = raw?.count ?? 0;
      aggregationFacts[`sum_amount_${suffix}`] = raw?.sum_amount ?? 0;
      aggregationFacts[`avg_amount_${suffix}`] = raw?.count > 0 ? raw?.avg_amount : null;
      aggregationFacts[`max_amount_${suffix}`] = raw?.count > 0 ? raw?.max_amount : null;
      aggregationFacts[`min_amount_${suffix}`] = raw?.count > 0 ? raw?.min_amount : null;

      // Count by type — single query with GROUP BY
      const typeCounts: Record<string, number> = {};
      const typeRows = await this.transactionRepository
        .createQueryBuilder('t')
        .select(['t.type AS type', 'COUNT(*)::int AS cnt'])
        .where('t.id_account = :accountId', { accountId: transaction.idAccount })
        .andWhere('t.id_organization = :orgId', { orgId: transaction.idOrganization })
        .andWhere('t.datetime >= :start', { start: bounds.start })
        .andWhere('t.datetime < :end', { end: bounds.end })
        .andWhere('t.id != :currentId', { currentId: transaction.id })
        .groupBy('t.type')
        .getRawMany();

      for (const row of typeRows) {
        typeCounts[row.type] = row.cnt;
      }
      aggregationFacts[`count_by_type_${suffix}`] = typeCounts;
    });

    // Run window aggregations, list facts, and behavioral facts IN PARALLEL
    const [, listFacts, behavioralFacts] = await Promise.all([
      Promise.all(windowPromises),
      this.complianceListService.resolveListFacts(transaction.idOrganization, {
        country: transaction.country,
        idAccount: transaction.idAccount,
        counterpartyId: transaction.counterpartyId,
      }),
      this.behavioralBaselineService.computeBehavioralFacts(transaction),
    ]);

    return {
      transaction: transactionFacts,
      aggregation: aggregationFacts,
      lists: listFacts,
      behavior: behavioralFacts.baseline,
      deviation: behavioralFacts.deviation,
    };
  }

  private async persistEvaluationResult(
    transaction: Transaction,
    result: EvaluationResultVO,
    startTime: number,
    manager?: EntityManager,
  ): Promise<EvaluationResult> {
    const repo = manager
      ? manager.getRepository(EvaluationResult)
      : this.evaluationResultRepository;
    const evalResult = repo.create({
      idOrganization: transaction.idOrganization,
      idTransaction: transaction.id,
      idAccount: transaction.idAccount,
      decision: result.decision,
      triggeredRules: result.triggeredRules,
      allRuleResults: result.allRuleResults,
      actions: result.actions,
      evaluatedAt: new Date(),
      evaluationDurationMs: Date.now() - startTime,
      createdBy: null,
    });

    return repo.save(evalResult);
  }

  private async generateAlerts(
    transaction: Transaction,
    evaluationResult: EvaluationResult,
    result: EvaluationResultVO,
    activeRules: RuleVersion[],
    manager?: EntityManager,
  ): Promise<Alert[]> {
    const alertRepo = manager ? manager.getRepository(Alert) : this.alertRepository;
    const alerts: Alert[] = [];

    // Pre-compute all dedup keys and batch-load existing active alerts
    const triggeredWithKeys: Array<{
      triggered: (typeof result.triggeredRules)[0];
      rule: RuleVersion;
      dedupKey: string;
      alertActions: ActionDefinition[];
    }> = [];

    for (const triggered of result.triggeredRules) {
      const rule = activeRules.find((r) => r.id === triggered.ruleVersionId);
      if (!rule) continue;

      const alertActions = (rule.actions as ActionDefinition[]).filter(
        (a) => a.type === 'create_alert',
      );
      if (alertActions.length === 0) continue;

      const dedupKey = Alert.computeDedupKey(
        transaction.idAccount,
        triggered.ruleVersionId,
        transaction.datetime,
        (rule.window as WindowSpec) || null,
      );

      triggeredWithKeys.push({ triggered, rule, dedupKey, alertActions });
    }

    // Batch-fetch all existing active alerts for these dedup keys in ONE query
    const existingAlertMap = new Map<string, Alert>();
    if (triggeredWithKeys.length > 0) {
      const dedupKeys = triggeredWithKeys.map((t) => t.dedupKey);
      const existingAlerts = await alertRepo
        .createQueryBuilder('a')
        .where('a.id_organization = :orgId', { orgId: transaction.idOrganization })
        .andWhere('a.dedup_key IN (:...dedupKeys)', { dedupKeys })
        .andWhere('a.status NOT IN (:...terminalStatuses)', {
          terminalStatuses: ['RESOLVED', 'DISMISSED'],
        })
        .getMany();

      for (const alert of existingAlerts) {
        existingAlertMap.set(alert.dedupKey, alert);
      }
    }

    for (const { triggered, rule, dedupKey, alertActions } of triggeredWithKeys) {
      const existingAlert = existingAlertMap.get(dedupKey);

      // If an active alert exists, suppress and consolidate — but keep full audit trail
      if (existingAlert) {
        existingAlert.suppressedCount = (existingAlert.suppressedCount || 0) + 1;

        const existingMeta = (existingAlert.metadata || {}) as Record<string, unknown>;
        const relatedTxIds: string[] = Array.isArray(existingMeta.relatedTransactionIds)
          ? [...(existingMeta.relatedTransactionIds as string[])]
          : [existingAlert.idTransaction];
        relatedTxIds.push(transaction.id);

        const relatedEvalIds: string[] = Array.isArray(existingMeta.relatedEvaluationResultIds)
          ? [...(existingMeta.relatedEvaluationResultIds as string[])]
          : [existingAlert.idEvaluationResult];
        relatedEvalIds.push(evaluationResult.id);

        existingAlert.metadata = {
          ...existingMeta,
          relatedTransactionIds: relatedTxIds,
          relatedEvaluationResultIds: relatedEvalIds,
          lastTriggeredTransactionId: transaction.id,
          lastTriggeredAt: new Date().toISOString(),
          lastEvaluationResultId: evaluationResult.id,
        };
        await alertRepo.save(existingAlert);
        this.logger.debug(
          `Alert dedup: suppressed duplicate for key=${dedupKey} (count=${existingAlert.suppressedCount}, totalTxs=${relatedTxIds.length})`,
        );
        continue;
      }

      for (const action of alertActions) {
        const alert = alertRepo.create({
          idOrganization: transaction.idOrganization,
          idEvaluationResult: evaluationResult.id,
          idRuleVersion: triggered.ruleVersionId,
          idTransaction: transaction.id,
          idAccount: transaction.idAccount,
          dedupKey,
          severity: (action.severity as string) || 'MEDIUM',
          category: (action.category as string) || 'COMPLIANCE',
          status: 'OPEN',
          message:
            (action.message as string) ||
            `Rule triggered: ${rule?.template?.name || triggered.ruleVersionId}`,
          metadata: {
            ruleVersionId: triggered.ruleVersionId,
            priority: triggered.priority,
            decision: result.decision,
          },
          suppressedCount: 0,
          createdBy: null,
        });

        alerts.push(alert);
      }
    }

    if (alerts.length > 0) {
      return alertRepo.save(alerts);
    }

    return [];
  }

  // ─── Read operations ────────────────────────────────────────────────

  async findTransactions(
    idOrganization: string,
    filters?: {
      idAccount?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    },
  ): Promise<{ items: Transaction[]; totalCount: number }> {
    const qb = this.transactionRepository
      .createQueryBuilder('t')
      .where('t.id_organization = :orgId', { orgId: idOrganization })
      .orderBy('t.datetime', 'DESC')
      .limit(filters?.limit || 50);

    if (filters?.idAccount) {
      qb.andWhere('t.id_account = :accountId', { accountId: filters.idAccount });
    }
    if (filters?.type) {
      qb.andWhere('t.type = :type', { type: filters.type });
    }
    if (filters?.startDate) {
      qb.andWhere('t.datetime >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      qb.andWhere('t.datetime <= :endDate', { endDate: filters.endDate });
    }

    const [items, totalCount] = await qb.getManyAndCount();

    return { items, totalCount };
  }

  async findEvaluationResults(
    idOrganization: string,
    filters?: {
      idTransaction?: string;
      idAccount?: string;
      decision?: string;
      limit?: number;
    },
  ): Promise<{ items: EvaluationResult[]; totalCount: number }> {
    const qb = this.evaluationResultRepository
      .createQueryBuilder('er')
      .where('er.id_organization = :orgId', { orgId: idOrganization })
      .orderBy('er.evaluated_at', 'DESC')
      .limit(filters?.limit || 50);

    if (filters?.idTransaction) {
      qb.andWhere('er.id_transaction = :txId', { txId: filters.idTransaction });
    }
    if (filters?.idAccount) {
      qb.andWhere('er.id_account = :accountId', { accountId: filters.idAccount });
    }
    if (filters?.decision) {
      qb.andWhere('er.decision = :decision', { decision: filters.decision });
    }

    const [items, totalCount] = await qb.getManyAndCount();

    return { items, totalCount };
  }
}
