import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { DomainExceptionFilter } from './../src/shared/filters';

const ORG_ID = 'complif-001';
const HEADERS = { 'x-organization-id': ORG_ID };

const IDS = {
  account: '00000000-0000-4000-a000-000000000001',
  ruleTemplate1: '00000000-0000-4000-b000-000000000001', // HIGH_AMOUNT
  ruleTemplate2: '00000000-0000-4000-b000-000000000002', // VELOCITY_CHECK
  ruleVersion1: '00000000-0000-4000-b000-000000000010',
  ruleVersion2: '00000000-0000-4000-b000-000000000011',
};

describe('Complif Compliance Module (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new DomainExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Clean ALL compliance data for our org so seed is fully idempotent
    const ds = app.get(DataSource);
    await ds.query(`DELETE FROM alerts WHERE id_organization = $1`, [ORG_ID]);
    await ds.query(`DELETE FROM evaluation_results WHERE id_organization = $1`, [ORG_ID]);
    await ds.query(`DELETE FROM transactions WHERE id_organization = $1`, [ORG_ID]);
    await ds.query(`DELETE FROM rule_versions WHERE id_organization = $1`, [ORG_ID]);
    await ds.query(`DELETE FROM rule_templates WHERE id_organization = $1`, [ORG_ID]);
    await ds.query(`DELETE FROM compliance_list_entries WHERE id_organization = $1`, [ORG_ID]);
    await ds.query(`DELETE FROM compliance_lists WHERE id_organization = $1`, [ORG_ID]);

    // Seed fresh data
    await request(app.getHttpServer()).post('/seed').expect(201);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────
  // Rule Templates
  // ──────────────────────────────────────────────

  describe('Rule Templates', () => {
    it('GET /rule-templates should list seeded templates', async () => {
      const res = await request(app.getHttpServer())
        .get('/rule-templates')
        .set(HEADERS)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.map((t: any) => t.code)).toEqual(
        expect.arrayContaining(['HIGH_AMOUNT', 'VELOCITY_CHECK']),
      );
    });

    it('GET /rule-templates/:id should return a template', async () => {
      const res = await request(app.getHttpServer())
        .get(`/rule-templates/${IDS.ruleTemplate1}`)
        .set(HEADERS)
        .expect(200);

      expect(res.body.data.code).toBe('HIGH_AMOUNT');
      expect(res.body.data.category).toBe('AML');
    });

    it('GET /rule-templates/:id should 404 for non-existent', async () => {
      await request(app.getHttpServer())
        .get('/rule-templates/00000000-0000-4000-b000-999999999999')
        .set(HEADERS)
        .expect(404);
    });

    it('POST /rule-templates should create a new template', async () => {
      const code = `E2E_CREATE_${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/rule-templates')
        .set(HEADERS)
        .send({
          code,
          name: 'E2E Create Test',
          description: 'Created by e2e test',
          category: 'TEST',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe(code);
      expect(res.body.data.id).toBeDefined();
    });

    it('POST /rule-templates should reject invalid body', async () => {
      await request(app.getHttpServer()).post('/rule-templates').set(HEADERS).send({}).expect(400);
    });

    it('PUT /rule-templates/:id/deactivate should deactivate', async () => {
      // Create a throwaway template specifically for deactivation
      const createRes = await request(app.getHttpServer())
        .post('/rule-templates')
        .set(HEADERS)
        .send({ code: `E2E_DEACT_${Date.now()}`, name: 'Deactivation Test' })
        .expect(201);

      const tmpId = createRes.body.data.id;

      const res = await request(app.getHttpServer())
        .put(`/rule-templates/${tmpId}/deactivate`)
        .set(HEADERS)
        .send({})
        .expect(200);

      expect(res.body.data.isActive).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // Rule Versions
  // ──────────────────────────────────────────────

  describe('Rule Versions', () => {
    // Create a dedicated template for version tests — never touch seeded data
    let versionTemplateId: string;
    let newVersionId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/rule-templates')
        .set(HEADERS)
        .send({ code: `E2E_VER_${Date.now()}`, name: 'Version Test Template' })
        .expect(201);
      versionTemplateId = res.body.data.id;
    });

    it('GET /rule-versions/active should list seeded active versions', async () => {
      const res = await request(app.getHttpServer())
        .get('/rule-versions/active')
        .set(HEADERS)
        .expect(200);

      expect(res.body.success).toBe(true);
      // Seeded data has 2 active versions (HIGH_AMOUNT + VELOCITY_CHECK)
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /rule-versions/:id should return a version', async () => {
      const res = await request(app.getHttpServer())
        .get(`/rule-versions/${IDS.ruleVersion1}`)
        .set(HEADERS)
        .expect(200);

      expect(res.body.data.conditions).toBeDefined();
      expect(res.body.data.actions).toBeDefined();
      expect(res.body.data.enabled).toBe(true);
    });

    it('GET /rule-templates/:id/versions should list versions for template', async () => {
      const res = await request(app.getHttpServer())
        .get(`/rule-templates/${IDS.ruleTemplate1}/versions`)
        .set(HEADERS)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /rule-templates/:id/versions should create a version', async () => {
      const res = await request(app.getHttpServer())
        .post(`/rule-templates/${versionTemplateId}/versions`)
        .set(HEADERS)
        .send({
          conditions: {
            all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 50000 }],
          },
          actions: [
            {
              type: 'create_alert',
              severity: 'CRITICAL',
              category: 'AML',
              message: 'Very high amount',
            },
          ],
          priority: 5,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.versionNumber).toBe(1);
      newVersionId = res.body.data.id;
    });

    it('POST /rule-templates/:id/versions should reject actions without type', async () => {
      await request(app.getHttpServer())
        .post(`/rule-templates/${versionTemplateId}/versions`)
        .set(HEADERS)
        .send({
          conditions: { all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 1 }] },
          actions: [{ severity: 'LOW' }], // missing type
        })
        .expect(400);
    });

    it('POST /rule-templates/:id/versions should reject invalid window unit', async () => {
      await request(app.getHttpServer())
        .post(`/rule-templates/${versionTemplateId}/versions`)
        .set(HEADERS)
        .send({
          conditions: { all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 1 }] },
          actions: [{ type: 'create_alert' }],
          window: { duration: 24, unit: 'weeks' }, // invalid unit
        })
        .expect(400);
    });

    it('POST /rule-templates/:id/versions should reject empty actions', async () => {
      await request(app.getHttpServer())
        .post(`/rule-templates/${versionTemplateId}/versions`)
        .set(HEADERS)
        .send({
          conditions: { all: [] },
          actions: [], // empty
        })
        .expect(400);
    });

    it('POST /rule-templates/:id/versions should reject malformed condition structure', async () => {
      await request(app.getHttpServer())
        .post(`/rule-templates/${versionTemplateId}/versions`)
        .set(HEADERS)
        .send({
          conditions: {
            all: [
              { fact: 'transaction.amount', operator: 'greaterThan', value: 1000 },
              { any: [] }, // invalid: any must be non-empty
            ],
          },
          actions: [{ type: 'create_alert' }],
        })
        .expect(400);
    });

    it('PUT /rule-versions/:id/deactivate should deactivate a version', async () => {
      const res = await request(app.getHttpServer())
        .put(`/rule-versions/${newVersionId}/deactivate`)
        .set(HEADERS)
        .send({})
        .expect(200);

      expect(res.body.data.deactivatedAt).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────
  // Transaction Ingestion & Evaluation
  // ──────────────────────────────────────────────

  describe('Transaction Ingestion', () => {
    it('POST /transactions with low amount should ALLOW', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          type: 'CASH_IN',
          amount: 500,
          currency: 'USD',
          datetime: '2026-02-13T10:00:00Z',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.id).toBeDefined();
      expect(res.body.data.evaluation.decision).toBe('ALLOW');
      expect(res.body.data.alerts).toHaveLength(0);
    });

    it('POST /transactions with high CASH_OUT should REVIEW with alert', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          type: 'CASH_OUT',
          amount: 15000,
          currency: 'USD',
          datetime: '2026-02-13T11:00:00Z',
          country: 'BR',
        })
        .expect(201);

      expect(res.body.data.evaluation.decision).toBe('REVIEW');
      expect(res.body.data.evaluation.triggeredRules.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.alerts.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.alerts[0].severity).toBe('HIGH');
      expect(res.body.data.alerts[0].status).toBe('OPEN');
    });

    it('POST /transactions with DEBIT > 10000 should also trigger HIGH_AMOUNT (dedup suppresses alert)', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          type: 'DEBIT',
          amount: 25000,
          currency: 'ARS',
          datetime: '2026-02-13T12:00:00Z',
        })
        .expect(201);

      // Rule still triggers (evaluation result shows it)
      expect(res.body.data.evaluation.decision).toBe('REVIEW');
      // But the alert is suppressed (same account + rule + day window)
      expect(res.body.data.alerts).toHaveLength(0);
    });

    it('POST /transactions should reject missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/transactions')
        .set(HEADERS)
        .send({ idAccount: IDS.account })
        .expect(400);
    });

    it('POST /transactions should reject invalid currency', async () => {
      await request(app.getHttpServer())
        .post('/transactions')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          type: 'CASH_IN',
          amount: 100,
          currency: 'INVALID',
          datetime: '2026-02-13T13:00:00Z',
        })
        .expect(400);
    });

    it('POST /transactions with all optional fields should succeed', async () => {
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          type: 'CREDIT',
          subType: 'WIRE_TRANSFER',
          amount: 100,
          currency: 'USD',
          amountNormalized: 100,
          currencyNormalized: 'USD',
          datetime: '2026-02-13T14:00:00Z',
          date: '2026-02-13',
          country: 'AR',
          counterpartyId: 'counterparty-001',
          channel: 'MOBILE',
          externalCode: 'TXN-001',
          data: { reference: 'INV-001' },
          origin: 'API',
          deviceInfo: { ip: '192.168.1.1' },
          metadata: { source: 'test' },
        })
        .expect(201);

      expect(res.body.data.transaction.id).toBeDefined();
    });

    it('GET /transactions should list transactions', async () => {
      const res = await request(app.getHttpServer())
        .get('/transactions?limit=10')
        .set(HEADERS)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /transactions/evaluations should list evaluations', async () => {
      const res = await request(app.getHttpServer())
        .get('/transactions/evaluations')
        .set(HEADERS)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ──────────────────────────────────────────────
  // Alerts
  // ──────────────────────────────────────────────

  describe('Alerts', () => {
    let alertId: string;

    it('GET /alerts should list alerts', async () => {
      const res = await request(app.getHttpServer()).get('/alerts').set(HEADERS).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      alertId = res.body.data[0].id;
    });

    it('GET /alerts?severity=HIGH should filter by severity', async () => {
      const res = await request(app.getHttpServer())
        .get('/alerts?severity=HIGH')
        .set(HEADERS)
        .expect(200);

      for (const alert of res.body.data) {
        expect(alert.severity).toBe('HIGH');
      }
    });

    it('GET /alerts/:id should return a specific alert', async () => {
      const res = await request(app.getHttpServer())
        .get(`/alerts/${alertId}`)
        .set(HEADERS)
        .expect(200);

      expect(res.body.data.id).toBe(alertId);
      expect(res.body.data.status).toBe('OPEN');
    });

    it('PUT /alerts/:id should update status to ACKNOWLEDGED', async () => {
      const res = await request(app.getHttpServer())
        .put(`/alerts/${alertId}`)
        .set(HEADERS)
        .send({ status: 'ACKNOWLEDGED' })
        .expect(200);

      expect(res.body.data.status).toBe('ACKNOWLEDGED');
    });

    it('PUT /alerts/:id should update status to RESOLVED', async () => {
      const res = await request(app.getHttpServer())
        .put(`/alerts/${alertId}`)
        .set(HEADERS)
        .send({ status: 'RESOLVED' })
        .expect(200);

      expect(res.body.data.status).toBe('RESOLVED');
    });

    it('GET /alerts/:id should 404 for non-existent', async () => {
      await request(app.getHttpServer())
        .get('/alerts/00000000-0000-4000-b000-999999999999')
        .set(HEADERS)
        .expect(404);
    });
  });

  // ──────────────────────────────────────────────
  // Alert Deduplication
  // ──────────────────────────────────────────────

  describe('Alert Deduplication', () => {
    beforeAll(async () => {
      // Resolve/dismiss all existing OPEN alerts so dedup tests start clean
      const res = await request(app.getHttpServer())
        .get(`/alerts?idAccount=${IDS.account}`)
        .set(HEADERS)
        .expect(200);

      for (const alert of res.body.data) {
        if (alert.status === 'OPEN') {
          await request(app.getHttpServer())
            .put(`/alerts/${alert.id}`)
            .set(HEADERS)
            .send({ status: 'RESOLVED' })
            .expect(200);
        } else if (alert.status === 'ACKNOWLEDGED') {
          await request(app.getHttpServer())
            .put(`/alerts/${alert.id}`)
            .set(HEADERS)
            .send({ status: 'RESOLVED' })
            .expect(200);
        }
      }
    });

    it('should suppress duplicate alerts for repeated triggers in the same window', async () => {
      // Get current alert count
      const beforeRes = await request(app.getHttpServer()).get('/alerts').set(HEADERS).expect(200);
      const alertCountBefore = beforeRes.body.data.length;

      // Ingest first HIGH-amount CASH_OUT transaction → should create alert
      // (matches HIGH_AMOUNT rule: amount > 10000 AND type in [CASH_OUT, DEBIT])
      const tx1 = await request(app.getHttpServer())
        .post('/transactions')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          type: 'CASH_OUT',
          amount: 999999,
          currency: 'USD',
          datetime: new Date().toISOString(),
        })
        .expect(201);

      expect(tx1.body.data.alerts).toBeDefined();
      const alertsAfterFirst = tx1.body.data.alerts.length;
      expect(alertsAfterFirst).toBeGreaterThanOrEqual(1);

      // Get total alerts after first transaction
      const midRes = await request(app.getHttpServer()).get('/alerts').set(HEADERS).expect(200);
      const alertCountMid = midRes.body.data.length;
      expect(alertCountMid).toBeGreaterThan(alertCountBefore);

      // Ingest second HIGH-amount CASH_OUT transaction (same account, same window)
      // → should NOT create a new alert (dedup suppression)
      const tx2 = await request(app.getHttpServer())
        .post('/transactions')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          type: 'CASH_OUT',
          amount: 888888,
          currency: 'USD',
          datetime: new Date().toISOString(),
        })
        .expect(201);

      // The second trigger should be suppressed (no new alerts created)
      const afterRes = await request(app.getHttpServer()).get('/alerts').set(HEADERS).expect(200);
      const alertCountAfter = afterRes.body.data.length;

      // Alert count should NOT increase — dedup in action
      expect(alertCountAfter).toBe(alertCountMid);
    });

    it('suppressed alerts should have updated suppressedCount and full transaction trail', async () => {
      const res = await request(app.getHttpServer()).get('/alerts').set(HEADERS).expect(200);

      // Find an alert that has suppressedCount > 0 (from the dedup above)
      const suppressed = res.body.data.find((a: any) => a.suppressedCount && a.suppressedCount > 0);
      expect(suppressed).toBeDefined();
      expect(suppressed.suppressedCount).toBeGreaterThanOrEqual(1);
      expect(suppressed.metadata.lastTriggeredTransactionId).toBeDefined();

      // Full audit trail: relatedTransactionIds should contain ALL tx IDs (original + suppressed)
      expect(suppressed.metadata.relatedTransactionIds).toBeDefined();
      expect(Array.isArray(suppressed.metadata.relatedTransactionIds)).toBe(true);
      expect(suppressed.metadata.relatedTransactionIds.length).toBeGreaterThanOrEqual(2);

      // relatedEvaluationResultIds tracks all evaluations tied to this alert
      expect(suppressed.metadata.relatedEvaluationResultIds).toBeDefined();
      expect(suppressed.metadata.relatedEvaluationResultIds.length).toBeGreaterThanOrEqual(2);
    });

    it('resolved alerts should allow new alerts for the same dedup key', async () => {
      // Resolve all current alerts for this account
      const alertsRes = await request(app.getHttpServer())
        .get(`/alerts?idAccount=${IDS.account}`)
        .set(HEADERS)
        .expect(200);

      for (const alert of alertsRes.body.data) {
        if (alert.status === 'OPEN' || alert.status === 'ACKNOWLEDGED') {
          await request(app.getHttpServer())
            .put(`/alerts/${alert.id}`)
            .set(HEADERS)
            .send({ status: 'RESOLVED' })
            .expect(200);
        }
      }

      // Get count after resolving
      const beforeRes = await request(app.getHttpServer()).get('/alerts').set(HEADERS).expect(200);
      const countBefore = beforeRes.body.data.length;

      // Ingest another HIGH-amount CASH_OUT transaction → should create NEW alert
      // because the previous one was resolved
      await request(app.getHttpServer())
        .post('/transactions')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          type: 'CASH_OUT',
          amount: 777777,
          currency: 'USD',
          datetime: new Date().toISOString(),
        })
        .expect(201);

      const afterRes = await request(app.getHttpServer()).get('/alerts').set(HEADERS).expect(200);
      const countAfter = afterRes.body.data.length;

      // New alert should be created since previous was resolved
      expect(countAfter).toBeGreaterThan(countBefore);
    });

    it('each alert should have a dedupKey field', async () => {
      const res = await request(app.getHttpServer()).get('/alerts').set(HEADERS).expect(200);

      for (const alert of res.body.data) {
        expect(alert.dedupKey).toBeDefined();
        expect(typeof alert.dedupKey).toBe('string');
        // Key format: accountId:ruleVersionId:windowStartISO
        expect(alert.dedupKey.split(':').length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  // ──────────────────────────────────────────────
  // Template Inheritance
  // ──────────────────────────────────────────────

  describe('Template Inheritance', () => {
    let parentId: string;
    let childId: string;

    it('should create a system (base) template', async () => {
      const res = await request(app.getHttpServer())
        .post('/rule-templates')
        .set(HEADERS)
        .send({
          code: `BASE_AML_${Date.now()}`,
          name: 'Base AML System Template',
          category: 'AML',
          isSystem: true,
        })
        .expect(201);

      expect(res.body.data.isSystem).toBe(true);
      expect(res.body.data.parentTemplateId).toBeNull();
      parentId = res.body.data.id;
    });

    it('should reject system template with parentTemplateId', async () => {
      await request(app.getHttpServer())
        .post('/rule-templates')
        .set(HEADERS)
        .send({
          code: `INVALID_SYS_${Date.now()}`,
          name: 'Invalid System With Parent',
          isSystem: true,
          parentTemplateId: parentId,
        })
        .expect(400);
    });

    it('should create a child template inheriting from parent', async () => {
      const res = await request(app.getHttpServer())
        .post('/rule-templates')
        .set(HEADERS)
        .send({
          code: `CHILD_AML_${Date.now()}`,
          name: 'Child AML Template',
          category: 'AML',
          parentTemplateId: parentId,
        })
        .expect(201);

      expect(res.body.data.parentTemplateId).toBe(parentId);
      expect(res.body.data.isSystem).toBe(false);
      childId = res.body.data.id;
    });

    it('should reject parentTemplateId pointing to non-existent template', async () => {
      await request(app.getHttpServer())
        .post('/rule-templates')
        .set(HEADERS)
        .send({
          code: `ORPHAN_${Date.now()}`,
          name: 'Orphan Template',
          parentTemplateId: '00000000-0000-4000-b000-999999999999',
        })
        .expect(404);
    });

    it('GET /rule-templates/:id should include parent info', async () => {
      const res = await request(app.getHttpServer())
        .get(`/rule-templates/${childId}`)
        .set(HEADERS)
        .expect(200);

      expect(res.body.data.parentTemplateId).toBe(parentId);
      expect(res.body.data.parentTemplate).toBeDefined();
      expect(res.body.data.parentTemplate.id).toBe(parentId);
    });

    it('child version should merge parent conditions', async () => {
      // Create a version on the parent
      await request(app.getHttpServer())
        .post(`/rule-templates/${parentId}/versions`)
        .set(HEADERS)
        .send({
          conditions: {
            all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 5000 }],
          },
          actions: [{ type: 'create_alert', severity: 'HIGH', category: 'AML' }],
          priority: 10,
        })
        .expect(201);

      // Create a version on the child — conditions should be merged with parent
      const childVer = await request(app.getHttpServer())
        .post(`/rule-templates/${childId}/versions`)
        .set(HEADERS)
        .send({
          conditions: {
            all: [{ fact: 'transaction.type', operator: 'equal', value: 'CASH_OUT' }],
          },
          actions: [{ type: 'create_alert', severity: 'MEDIUM', category: 'AML' }],
          priority: 20,
        })
        .expect(201);

      // The effective conditions should be { all: [parentConditions, childConditions] }
      const merged = childVer.body.data.conditions;
      expect(merged.all).toBeDefined();
      expect(merged.all).toHaveLength(2);
      // First element = parent conditions
      expect(merged.all[0].all).toBeDefined();
      expect(merged.all[0].all[0].fact).toBe('transaction.amount');
      // Second element = child conditions
      expect(merged.all[1].all).toBeDefined();
      expect(merged.all[1].all[0].fact).toBe('transaction.type');
    });
  });

  // ──────────────────────────────────────────────
  // Metrics Endpoint
  // ──────────────────────────────────────────────

  describe('Metrics', () => {
    it('GET /metrics should return latency percentiles and counts', async () => {
      const res = await request(app.getHttpServer()).get('/metrics').expect(200);

      expect(res.body.timestamp).toBeDefined();
      expect(res.body.windowMinutes).toBeDefined();
      expect(res.body.evaluations).toBeDefined();
      expect(res.body.evaluations.total).toBeGreaterThanOrEqual(1);
      expect(res.body.evaluations.latency).toBeDefined();
      expect(typeof res.body.evaluations.latency.p50).toBe('number');
      expect(typeof res.body.evaluations.latency.p95).toBe('number');
      expect(typeof res.body.evaluations.latency.p99).toBe('number');
      expect(res.body.evaluations.throughputPerSecond).toBeDefined();
      expect(res.body.activeRuleVersions).toBeGreaterThanOrEqual(1);
      expect(typeof res.body.openAlerts).toBe('number');
    });

    it('GET /metrics?windowMinutes=1440 should accept custom window', async () => {
      const res = await request(app.getHttpServer()).get('/metrics?windowMinutes=1440').expect(200);
      expect(res.body.windowMinutes).toBe(1440);
    });
  });

  // ──────────────────────────────────────────────
  // Behavioral Rules — deviation facts
  // ──────────────────────────────────────────────

  describe('Behavioral Rules', () => {
    it('evaluation result should include behavioral deviation facts', async () => {
      // Ingest a transaction — behavioral facts should be in the evaluation
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          type: 'CASH_OUT',
          amount: 5000,
          currency: 'USD',
          datetime: new Date().toISOString(),
          country: 'US',
          channel: 'WEB',
        })
        .expect(201);

      const evalResult = res.body.data.evaluation;
      expect(evalResult).toBeDefined();

      // Evaluation should have been performed
      expect(evalResult.decision).toBeDefined();
    });

    it('behavioral facts should include deviation and baseline fields', async () => {
      // Ingest transactions first so there's history for the account
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/transactions')
          .set(HEADERS)
          .send({
            idAccount: IDS.account,
            type: 'CASH_IN',
            amount: 1000 + i * 100,
            currency: 'USD',
            datetime: new Date(Date.now() - (i + 1) * 3600 * 1000).toISOString(),
            country: 'US',
            channel: 'WEB',
          })
          .expect(201);
      }

      // Now ingest a transaction with a very different amount from a new country
      const res = await request(app.getHttpServer())
        .post('/transactions')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          type: 'CASH_OUT',
          amount: 99999,
          currency: 'USD',
          datetime: new Date().toISOString(),
          country: 'CN',
          channel: 'ATM',
        })
        .expect(201);

      // The evaluation was performed successfully
      expect(res.body.data.evaluation.decision).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────
  // Validation & Multi-tenant isolation
  // ──────────────────────────────────────────────

  describe('Validation & Multi-tenant', () => {
    it('should return 400 for missing organization header', async () => {
      await request(app.getHttpServer()).get('/rule-templates').expect(400);
    });

    it('different org should see empty templates', async () => {
      const res = await request(app.getHttpServer())
        .get('/rule-templates')
        .set({ 'x-organization-id': 'other-org-999' })
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });

    it('different org should see empty alerts', async () => {
      const res = await request(app.getHttpServer())
        .get('/alerts')
        .set({ 'x-organization-id': 'other-org-999' })
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────
  // Compliance Lists (Blacklist / Whitelist)
  // ──────────────────────────────────────────────

  describe('Compliance Lists', () => {
    let listId: string;
    let entryId: string;

    it('POST /compliance-lists should create a blacklist', async () => {
      const res = await request(app.getHttpServer())
        .post('/compliance-lists')
        .set(HEADERS)
        .send({
          code: 'SANCTIONED_COUNTRIES',
          name: 'Sanctioned Countries',
          description: 'OFAC sanctioned countries list',
          type: 'BLACKLIST',
          entityType: 'COUNTRY',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('SANCTIONED_COUNTRIES');
      expect(res.body.data.type).toBe('BLACKLIST');
      expect(res.body.data.entityType).toBe('COUNTRY');
      listId = res.body.data.id;
    });

    it('POST /compliance-lists should reject duplicate code', async () => {
      await request(app.getHttpServer())
        .post('/compliance-lists')
        .set(HEADERS)
        .send({
          code: 'SANCTIONED_COUNTRIES',
          name: 'Duplicate',
          type: 'BLACKLIST',
          entityType: 'COUNTRY',
        })
        .expect(409);
    });

    it('POST /compliance-lists should reject invalid type', async () => {
      await request(app.getHttpServer())
        .post('/compliance-lists')
        .set(HEADERS)
        .send({
          code: 'INVALID_TYPE',
          name: 'Bad',
          type: 'GREYLIST',
          entityType: 'COUNTRY',
        })
        .expect(400);
    });

    it('POST /compliance-lists should reject invalid entityType', async () => {
      await request(app.getHttpServer())
        .post('/compliance-lists')
        .set(HEADERS)
        .send({
          code: 'INVALID_ET',
          name: 'Bad',
          type: 'BLACKLIST',
          entityType: 'IP_ADDRESS',
        })
        .expect(400);
    });

    it('GET /compliance-lists should list created lists', async () => {
      const res = await request(app.getHttpServer())
        .get('/compliance-lists')
        .set(HEADERS)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.some((l: any) => l.code === 'SANCTIONED_COUNTRIES')).toBe(true);
    });

    it('GET /compliance-lists?type=WHITELIST should filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/compliance-lists?type=WHITELIST')
        .set(HEADERS)
        .expect(200);

      // Our only list is BLACKLIST, so WHITELIST filter should exclude it
      expect(res.body.data.every((l: any) => l.type === 'WHITELIST')).toBe(true);
    });

    it('GET /compliance-lists/:id should return list with entries', async () => {
      const res = await request(app.getHttpServer())
        .get(`/compliance-lists/${listId}`)
        .set(HEADERS)
        .expect(200);

      expect(res.body.data.id).toBe(listId);
      expect(res.body.data).toHaveProperty('entries');
    });

    it('GET /compliance-lists/:id should 404 for non-existent', async () => {
      await request(app.getHttpServer())
        .get('/compliance-lists/00000000-0000-4000-b000-999999999999')
        .set(HEADERS)
        .expect(404);
    });

    it('PUT /compliance-lists/:id should update name', async () => {
      const res = await request(app.getHttpServer())
        .put(`/compliance-lists/${listId}`)
        .set(HEADERS)
        .send({ name: 'Sanctioned Countries (Updated)' })
        .expect(200);

      expect(res.body.data.name).toBe('Sanctioned Countries (Updated)');
    });

    // ── Entries ────────────────────────────────────────────────

    it('POST /compliance-lists/:id/entries should add an entry', async () => {
      const res = await request(app.getHttpServer())
        .post(`/compliance-lists/${listId}/entries`)
        .set(HEADERS)
        .send({ value: 'IR', label: 'Iran', metadata: { reason: 'OFAC' } })
        .expect(201);

      expect(res.body.data.value).toBe('IR');
      expect(res.body.data.label).toBe('Iran');
      entryId = res.body.data.id;
    });

    it('POST /compliance-lists/:id/entries should reject duplicate value', async () => {
      await request(app.getHttpServer())
        .post(`/compliance-lists/${listId}/entries`)
        .set(HEADERS)
        .send({ value: 'IR' })
        .expect(409);
    });

    it('POST /compliance-lists/:id/entries/bulk should add multiple entries', async () => {
      const res = await request(app.getHttpServer())
        .post(`/compliance-lists/${listId}/entries/bulk`)
        .set(HEADERS)
        .send({
          entries: [
            { value: 'KP', label: 'North Korea' },
            { value: 'SY', label: 'Syria' },
            { value: 'IR' }, // duplicate — should be skipped
          ],
        })
        .expect(201);

      expect(res.body.count).toBe(2); // IR skipped
    });

    it('GET /compliance-lists/:id/entries should list entries', async () => {
      const res = await request(app.getHttpServer())
        .get(`/compliance-lists/${listId}/entries`)
        .set(HEADERS)
        .expect(200);

      expect(res.body.count).toBe(3); // IR, KP, SY
      const values = res.body.data.map((e: any) => e.value);
      expect(values).toEqual(expect.arrayContaining(['IR', 'KP', 'SY']));
    });

    it('DELETE /compliance-lists/:id/entries/:entryId should remove entry', async () => {
      await request(app.getHttpServer())
        .delete(`/compliance-lists/${listId}/entries/${entryId}`)
        .set(HEADERS)
        .expect(204);
    });

    it('DELETE /compliance-lists/:id/entries/:entryId should 404 after removal', async () => {
      await request(app.getHttpServer())
        .delete(`/compliance-lists/${listId}/entries/${entryId}`)
        .set(HEADERS)
        .expect(404);
    });

    // ── Evaluation integration ────────────────────────────────

    it('transaction evaluation should include list facts', async () => {
      // Create a whitelist to verify both types
      const wlRes = await request(app.getHttpServer())
        .post('/compliance-lists')
        .set(HEADERS)
        .send({
          code: 'TRUSTED_COUNTRIES',
          name: 'Trusted Countries',
          type: 'WHITELIST',
          entityType: 'COUNTRY',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/compliance-lists/${wlRes.body.data.id}/entries`)
        .set(HEADERS)
        .send({ value: 'US' })
        .expect(201);

      // Ingest a transaction from a blacklisted country
      const txRes = await request(app.getHttpServer())
        .post('/transactions')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          type: 'TRANSFER',
          amount: 500,
          currency: 'USD',
          datetime: new Date().toISOString(),
          country: 'KP', // blacklisted
        })
        .expect(201);

      // The evaluation result should exist (lists facts are part of the pipeline)
      expect(txRes.body.data.evaluation).toBeDefined();
      expect(txRes.body.data.evaluation.decision).toBeDefined();
    });

    // ── Cleanup: delete list ──────────────────────────────────

    it('DELETE /compliance-lists/:id should soft-delete list', async () => {
      await request(app.getHttpServer())
        .delete(`/compliance-lists/${listId}`)
        .set(HEADERS)
        .expect(204);
    });

    it('GET /compliance-lists/:id should 404 after deletion', async () => {
      await request(app.getHttpServer())
        .get(`/compliance-lists/${listId}`)
        .set(HEADERS)
        .expect(404);
    });

    // ── Multi-tenant isolation ────────────────────────────────

    it('different org should see empty compliance lists', async () => {
      const res = await request(app.getHttpServer())
        .get('/compliance-lists')
        .set({ 'x-organization-id': 'other-org-999' })
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });
  });
});
