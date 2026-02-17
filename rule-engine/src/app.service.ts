import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisCacheService } from './shared/cache';

const ORG_ID = 'complif-001';

const IDS = {
  account: '00000000-0000-4000-a000-000000000001',
  faculty: '00000000-0000-4000-a000-000000000002',
  schema: '00000000-0000-4000-a000-000000000003',
  groupA: '00000000-0000-4000-a000-000000000010',
  groupB: '00000000-0000-4000-a000-000000000011',
  groupC: '00000000-0000-4000-a000-000000000012',
  signer1: '00000000-0000-4000-a000-000000000020',
  signer2: '00000000-0000-4000-a000-000000000021',
  signer3: '00000000-0000-4000-a000-000000000022',
  signer4: '00000000-0000-4000-a000-000000000023',
  signer5: '00000000-0000-4000-a000-000000000024',
  rule1: '00000000-0000-4000-a000-000000000030',
  rule2: '00000000-0000-4000-a000-000000000031',
  // Compliance module
  ruleTemplate1: '00000000-0000-4000-b000-000000000001',
  ruleTemplate2: '00000000-0000-4000-b000-000000000002',
  ruleVersion1: '00000000-0000-4000-b000-000000000010',
  ruleVersion2: '00000000-0000-4000-b000-000000000011',
} as const;

@Injectable()
export class AppService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheService: RedisCacheService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async seed(): Promise<typeof IDS> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      await qr.query(
        `INSERT INTO accounts (id, id_organization, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
        [IDS.account, ORG_ID, 'Test Company S.A.'],
      );

      await qr.query(
        `INSERT INTO faculties (id, id_organization, code, name, description, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
        [
          IDS.faculty,
          ORG_ID,
          'APPROVE_WIRE',
          'Approve Wire Transfer',
          'Authorization for wire transfer approvals',
        ],
      );

      await qr.query(
        `INSERT INTO signature_schemas (id, id_organization, id_account, name, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
        [IDS.schema, ORG_ID, IDS.account, 'Payment Authorization Schema'],
      );

      await qr.query(
        `INSERT INTO signer_groups (id, id_organization, id_signature_schema, code, name, description, priority, created_at, updated_at)
         VALUES
           ($1, $2, $3, 'A', 'Directors', 'Board of Directors', 0, NOW(), NOW()),
           ($4, $2, $3, 'B', 'Managers', 'Department Managers', 0, NOW(), NOW()),
           ($5, $2, $3, 'C', 'Officers', 'Compliance Officers', 0, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [IDS.groupA, ORG_ID, IDS.schema, IDS.groupB, IDS.groupC],
      );

      await qr.query(
        `INSERT INTO signers (id, id_organization, id_account, name, email, status, created_at, updated_at)
         VALUES
           ($1, $2, $3, 'John Smith', 'director1@company.com', 'ACTIVE', NOW(), NOW()),
           ($4, $2, $3, 'Jane Doe', 'director2@company.com', 'ACTIVE', NOW(), NOW()),
           ($5, $2, $3, 'Bob Johnson', 'manager1@company.com', 'ACTIVE', NOW(), NOW()),
           ($6, $2, $3, 'Alice Williams', 'manager2@company.com', 'ACTIVE', NOW(), NOW()),
           ($7, $2, $3, 'Charlie Brown', 'officer@company.com', 'ACTIVE', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [IDS.signer1, ORG_ID, IDS.account, IDS.signer2, IDS.signer3, IDS.signer4, IDS.signer5],
      );

      await qr.query(
        `INSERT INTO signer_group_members (id_group, id_signer)
         VALUES ($1, $2), ($1, $3), ($4, $5), ($4, $6), ($7, $8)
         ON CONFLICT DO NOTHING`,
        [
          IDS.groupA,
          IDS.signer1,
          IDS.signer2,
          IDS.groupB,
          IDS.signer3,
          IDS.signer4,
          IDS.groupC,
          IDS.signer5,
        ],
      );

      const ruleDef1 = JSON.stringify({
        any: [
          { group: 'A', min: 1 },
          { group: 'B', min: 2 },
        ],
      });
      const ruleDef2 = JSON.stringify({
        any: [
          {
            all: [
              { group: 'A', min: 1 },
              { group: 'B', min: 1 },
            ],
          },
          { group: 'C', min: 2 },
        ],
      });

      await qr.query(
        `INSERT INTO signature_rules (id, id_organization, id_signature_schema, id_faculty, name, description, rule_definition, is_active, priority, created_at, updated_at)
         VALUES
           ($1, $2, $3, $4, 'Simple Wire Approval', '1 Director OR 2 Managers', $5, true, 0, NOW(), NOW()),
           ($6, $2, $3, $4, 'Complex Wire Approval', '(1 Director AND 1 Manager) OR 2 Officers', $7, true, 0, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [IDS.rule1, ORG_ID, IDS.schema, IDS.faculty, ruleDef1, IDS.rule2, ruleDef2],
      );

      // ── Compliance Module ─────────────────────────────────────

      // Clean up ALL versions referencing seeded templates (not just by known IDs)
      // This prevents FK violations when extra versions were created via API/tests
      await qr.query(`DELETE FROM rule_versions WHERE id_rule_template IN ($1, $2)`, [
        IDS.ruleTemplate1,
        IDS.ruleTemplate2,
      ]);
      await qr.query(`DELETE FROM rule_templates WHERE id IN ($1, $2)`, [
        IDS.ruleTemplate1,
        IDS.ruleTemplate2,
      ]);

      await qr.query(
        `INSERT INTO rule_templates (id, id_organization, code, name, description, category, is_active, is_system, created_at, updated_at)
         VALUES
           ($1, $2, 'HIGH_AMOUNT', 'High Amount Transaction', 'Flags transactions above threshold', 'AML', true, true, NOW(), NOW()),
           ($3, $2, 'VELOCITY_CHECK', 'Transaction Velocity', 'Flags accounts with high transaction frequency', 'FRAUD', true, false, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [IDS.ruleTemplate1, ORG_ID, IDS.ruleTemplate2],
      );

      const highAmountConditions = JSON.stringify({
        all: [
          { fact: 'transaction.amount', operator: 'greaterThan', value: 10000 },
          { fact: 'transaction.type', operator: 'in', value: ['CASH_OUT', 'DEBIT'] },
        ],
      });
      const highAmountActions = JSON.stringify([
        {
          type: 'create_alert',
          severity: 'HIGH',
          category: 'AML',
          message: 'High amount transaction detected',
        },
      ]);

      const velocityConditions = JSON.stringify({
        all: [{ fact: 'aggregation.count_24hours', operator: 'greaterThan', value: 5 }],
      });
      const velocityActions = JSON.stringify([
        {
          type: 'create_alert',
          severity: 'MEDIUM',
          category: 'FRAUD',
          message: 'High transaction velocity detected',
        },
      ]);
      const velocityWindow = JSON.stringify({ duration: 24, unit: 'hours' });

      await qr.query(
        `INSERT INTO rule_versions (id, id_organization, id_rule_template, version_number, conditions, actions, "window", priority, enabled, activated_at, created_at, updated_at)
         VALUES
           ($1, $2, $3, 1, $4, $5, NULL, 10, true, NOW(), NOW(), NOW()),
           ($6, $2, $7, 1, $8, $9, $10, 20, true, NOW(), NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          IDS.ruleVersion1,
          ORG_ID,
          IDS.ruleTemplate1,
          highAmountConditions,
          highAmountActions,
          IDS.ruleVersion2,
          IDS.ruleTemplate2,
          velocityConditions,
          velocityActions,
          velocityWindow,
        ],
      );

      await qr.commitTransaction();
      return IDS;
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }

  /**
   * Compute performance metrics from persisted evaluation results.
   * Uses a raw SQL query with percentile_cont for accurate p50/p95/p99.
   */
  async getMetrics(windowMinutes = 60): Promise<Record<string, unknown>> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    // Latency percentiles — single efficient query using PostgreSQL native percentile_cont
    const latencyResult = await this.dataSource.query(
      `SELECT
         COUNT(*)::int                                                  AS total_evaluations,
         COALESCE(ROUND(AVG(evaluation_duration_ms)::numeric, 2), 0)   AS avg_ms,
         COALESCE(MIN(evaluation_duration_ms), 0)                      AS min_ms,
         COALESCE(MAX(evaluation_duration_ms), 0)                      AS max_ms,
         COALESCE((PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY evaluation_duration_ms))::int, 0) AS p50_ms,
         COALESCE((PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY evaluation_duration_ms))::int, 0) AS p95_ms,
         COALESCE((PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY evaluation_duration_ms))::int, 0) AS p99_ms
       FROM evaluation_results
       WHERE evaluated_at >= $1`,
      [since],
    );

    const stats = latencyResult[0] || {};

    // Throughput — evaluations per second during the measurement window
    const elapsed = Math.max((Date.now() - new Date(since).getTime()) / 1000, 1);
    const throughput = parseFloat((stats.total_evaluations / elapsed).toFixed(2));

    // Active rule versions count
    const ruleCountResult = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM rule_versions WHERE enabled = true`,
    );

    // Alert count (open alerts)
    const alertCountResult = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM alerts WHERE status IN ('OPEN', 'ACKNOWLEDGED') AND deleted_at IS NULL`,
    );

    return {
      timestamp: new Date().toISOString(),
      windowMinutes,
      evaluations: {
        total: stats.total_evaluations,
        latency: {
          avg: parseFloat(stats.avg_ms),
          min: stats.min_ms,
          max: stats.max_ms,
          p50: stats.p50_ms,
          p95: stats.p95_ms,
          p99: stats.p99_ms,
        },
        throughputPerSecond: throughput,
      },
      activeRuleVersions: ruleCountResult[0]?.count || 0,
      openAlerts: alertCountResult[0]?.count || 0,
      cache: this.cacheService.getMetrics(),
    };
  }
}
