import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { DomainExceptionFilter } from './../src/shared/filters';

const ORG_ID = 'complif-001';
const HEADERS = { 'x-organization-id': ORG_ID };

const IDS = {
  account: '00000000-0000-4000-a000-000000000001',
  faculty: '00000000-0000-4000-a000-000000000002',
  schema: '00000000-0000-4000-a000-000000000003',
  groupA: '00000000-0000-4000-a000-000000000010',
  groupB: '00000000-0000-4000-a000-000000000011',
  groupC: '00000000-0000-4000-a000-000000000012',
  signer1: '00000000-0000-4000-a000-000000000020', // Director 1 (Group A)
  signer2: '00000000-0000-4000-a000-000000000021', // Director 2 (Group A)
  signer3: '00000000-0000-4000-a000-000000000022', // Manager 1 (Group B)
  signer4: '00000000-0000-4000-a000-000000000023', // Manager 2 (Group B)
  signer5: '00000000-0000-4000-a000-000000000024', // Officer (Group C)
  rule1: '00000000-0000-4000-a000-000000000030', // Simple: 1A OR 2B
  rule2: '00000000-0000-4000-a000-000000000031', // Complex: (1A AND 1B) OR 2C
};

describe('Complif Signature Module (e2e)', () => {
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

    // Seed the database
    await request(app.getHttpServer()).post('/seed');
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────
  // Health & Seed
  // ──────────────────────────────────────────────

  describe('Health & Seed', () => {
    it('GET / should return Hello World', () => {
      return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
    });

    it('GET /health should return ok', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.timestamp).toBeDefined();
        });
    });

    it('POST /seed should be idempotent', () => {
      return request(app.getHttpServer())
        .post('/seed')
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.account).toBe(IDS.account);
        });
    });
  });

  // ──────────────────────────────────────────────
  // Signature Rules
  // ──────────────────────────────────────────────

  describe('Signature Rules', () => {
    it('GET /signature-rules/:id should return a rule', () => {
      return request(app.getHttpServer())
        .get(`/signature-rules/${IDS.rule1}`)
        .set(HEADERS)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBe(IDS.rule1);
          expect(res.body.data.name).toBe('Simple Wire Approval');
          expect(res.body.data.ruleDefinition).toBeDefined();
        });
    });

    it('GET /signature-rules?schemaId= should list rules for a schema', () => {
      return request(app.getHttpServer())
        .get(`/signature-rules?schemaId=${IDS.schema}`)
        .set(HEADERS)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('GET /signature-rules/:id/combinations should return possible combos', () => {
      return request(app.getHttpServer())
        .get(`/signature-rules/${IDS.rule1}/combinations`)
        .set(HEADERS)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ A: 1 }),
              expect.objectContaining({ B: 2 }),
            ]),
          );
        });
    });

    it('GET /signature-rules/:id should 404 for non-existent rule', () => {
      return request(app.getHttpServer())
        .get('/signature-rules/00000000-0000-4000-a000-999999999999')
        .set(HEADERS)
        .expect(404);
    });

    it('should reject missing x-organization-id header', () => {
      return request(app.getHttpServer()).get(`/signature-rules/${IDS.rule1}`).expect(400);
    });

    it('GET /signature-rules/:id/combinations should 404 for non-existent rule', () => {
      return request(app.getHttpServer())
        .get('/signature-rules/00000000-0000-4000-a000-999999999999/combinations')
        .set(HEADERS)
        .expect(404);
    });

    it('GET /signature-rules/:id/combinations should return combos for complex rule', () => {
      return request(app.getHttpServer())
        .get(`/signature-rules/${IDS.rule2}/combinations`)
        .set(HEADERS)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          // (1A AND 1B) OR 2C → combos should include {A:1,B:1} and {C:2}
          expect(res.body.data).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ A: 1, B: 1 }),
              expect.objectContaining({ C: 2 }),
            ]),
          );
        });
    });

    it('GET /signature-rules?schemaId=<non-existent> should return empty array', () => {
      return request(app.getHttpServer())
        .get('/signature-rules?schemaId=00000000-0000-4000-a000-999999999999')
        .set(HEADERS)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toEqual([]);
        });
    });
  });

  // ──────────────────────────────────────────────
  // Signature Rule CRUD
  // ──────────────────────────────────────────────

  describe('Signature Rule CRUD', () => {
    let createdRuleId: string;

    it('POST /signature-rules should create a rule', async () => {
      const res = await request(app.getHttpServer())
        .post('/signature-rules')
        .set(HEADERS)
        .send({
          idSignatureSchema: IDS.schema,
          idFaculty: IDS.faculty,
          name: 'E2E CRUD Rule',
          description: 'Created by e2e test',
          isActive: true,
          priority: 5,
          ruleDefinition: {
            any: [
              { group: 'A', min: 1 },
              { group: 'B', min: 2 },
            ],
          },
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('E2E CRUD Rule');
      expect(res.body.data.priority).toBe(5);
      expect(res.body.data.id).toBeDefined();
      createdRuleId = res.body.data.id;
    });

    it('POST /signature-rules should reject empty body', () => {
      return request(app.getHttpServer())
        .post('/signature-rules')
        .set(HEADERS)
        .send({})
        .expect(400);
    });

    it('POST /signature-rules should reject invalid ruleDefinition (min < 1)', () => {
      return request(app.getHttpServer())
        .post('/signature-rules')
        .set(HEADERS)
        .send({
          idSignatureSchema: IDS.schema,
          idFaculty: IDS.faculty,
          name: 'Bad Rule',
          ruleDefinition: { group: 'A', min: 0 },
        })
        .expect(400);
    });

    it('POST /signature-rules should reject non-UUID schema ID', () => {
      return request(app.getHttpServer())
        .post('/signature-rules')
        .set(HEADERS)
        .send({
          idSignatureSchema: 'not-a-uuid',
          idFaculty: IDS.faculty,
          name: 'Bad Rule',
          ruleDefinition: { group: 'A', min: 1 },
        })
        .expect(400);
    });

    it('POST /signature-rules should reject unknown properties', () => {
      return request(app.getHttpServer())
        .post('/signature-rules')
        .set(HEADERS)
        .send({
          idSignatureSchema: IDS.schema,
          idFaculty: IDS.faculty,
          name: 'Rule',
          ruleDefinition: { group: 'A', min: 1 },
          unknownField: 'foo',
        })
        .expect(400);
    });

    it('PUT /signature-rules/:id should update a rule', async () => {
      const res = await request(app.getHttpServer())
        .put(`/signature-rules/${createdRuleId}`)
        .set(HEADERS)
        .send({ name: 'E2E CRUD Rule Updated', isActive: false })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('E2E CRUD Rule Updated');
      expect(res.body.data.isActive).toBe(false);
    });

    it('PUT /signature-rules/:id should update ruleDefinition', async () => {
      const res = await request(app.getHttpServer())
        .put(`/signature-rules/${createdRuleId}`)
        .set(HEADERS)
        .send({
          ruleDefinition: {
            all: [
              { group: 'A', min: 1 },
              { group: 'B', min: 1 },
            ],
          },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.ruleDefinition).toEqual({
        all: [
          { group: 'A', min: 1 },
          { group: 'B', min: 1 },
        ],
      });
    });

    it('PUT /signature-rules/:id should 404 for non-existent rule', () => {
      return request(app.getHttpServer())
        .put('/signature-rules/00000000-0000-4000-a000-999999999999')
        .set(HEADERS)
        .send({ name: 'Ghost' })
        .expect(404);
    });

    it('DELETE /signature-rules/:id should soft-delete a rule', () => {
      return request(app.getHttpServer())
        .delete(`/signature-rules/${createdRuleId}`)
        .set(HEADERS)
        .expect(204);
    });

    it('GET /signature-rules/:id should 404 after soft-delete', () => {
      return request(app.getHttpServer())
        .get(`/signature-rules/${createdRuleId}`)
        .set(HEADERS)
        .expect(404);
    });

    it('DELETE /signature-rules/:id should 404 for non-existent rule', () => {
      return request(app.getHttpServer())
        .delete('/signature-rules/00000000-0000-4000-a000-999999999999')
        .set(HEADERS)
        .expect(404);
    });
  });

  // ──────────────────────────────────────────────
  // Signature Request Lifecycle
  // ──────────────────────────────────────────────

  describe('Signature Request Lifecycle', () => {
    let requestId: string;

    it('POST /signature-requests should create a request', async () => {
      const res = await request(app.getHttpServer())
        .post('/signature-requests')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          idFaculty: IDS.faculty,
          idRule: IDS.rule1,
          referenceId: 'E2E-TEST-001',
          referenceType: 'WIRE_TRANSFER',
          description: 'E2E test wire transfer',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CREATED');
      expect(res.body.data.ruleSnapshot).toBeDefined();
      expect(res.body.data.signatures).toEqual([]);
      requestId = res.body.data.id;
    });

    it('GET /signature-requests/:id should return status with combinations', async () => {
      const res = await request(app.getHttpServer())
        .get(`/signature-requests/${requestId}`)
        .set(HEADERS)
        .expect(200);

      expect(res.body.data.isCompleted).toBe(false);
      expect(res.body.data.remainingRequired).toBeDefined();
      expect(res.body.data.possibleCombinations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ A: 1 }),
          expect.objectContaining({ B: 2 }),
        ]),
      );
    });

    it('should reject request creation with invalid rule ID', () => {
      return request(app.getHttpServer())
        .post('/signature-requests')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          idFaculty: IDS.faculty,
          idRule: '00000000-0000-4000-a000-999999999999',
        })
        .expect(404);
    });

    it('should reject request creation with missing required fields', () => {
      return request(app.getHttpServer())
        .post('/signature-requests')
        .set(HEADERS)
        .send({})
        .expect(400);
    });
  });

  // ──────────────────────────────────────────────
  // Scenario: Complete with 1 Director (1A satisfies "1A OR 2B")
  // ──────────────────────────────────────────────

  describe('Scenario: Complete with 1 Director', () => {
    let requestId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer()).post('/signature-requests').set(HEADERS).send({
        idAccount: IDS.account,
        idFaculty: IDS.faculty,
        idRule: IDS.rule1,
        referenceId: 'E2E-DIRECTOR-001',
        referenceType: 'WIRE_TRANSFER',
      });
      requestId = res.body.data.id;
    });

    it('should complete after 1 Director signs', async () => {
      const res = await request(app.getHttpServer())
        .post(`/signature-requests/${requestId}/signatures`)
        .set(HEADERS)
        .send({
          idSigner: IDS.signer1,
          idGroup: IDS.groupA,
          ipAddress: '10.0.0.1',
          userAgent: 'E2E-Test',
        })
        .expect(200);

      expect(res.body.data.isCompleted).toBe(true);
      expect(res.body.data.request.status).toBe('COMPLETED');
      expect(res.body.data.remainingRequired).toBeNull();
    });

    it('should reject adding signature to completed request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/signature-requests/${requestId}/signatures`)
        .set(HEADERS)
        .send({
          idSigner: IDS.signer2,
          idGroup: IDS.groupA,
        })
        .expect(409);

      expect(res.body.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // Scenario: Complete with 2 Managers (2B satisfies "1A OR 2B")
  // ──────────────────────────────────────────────

  describe('Scenario: Complete with 2 Managers', () => {
    let requestId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer()).post('/signature-requests').set(HEADERS).send({
        idAccount: IDS.account,
        idFaculty: IDS.faculty,
        idRule: IDS.rule1,
        referenceId: 'E2E-MANAGERS-001',
        referenceType: 'WIRE_TRANSFER',
      });
      requestId = res.body.data.id;
    });

    it('should NOT complete after 1 Manager signs', async () => {
      const res = await request(app.getHttpServer())
        .post(`/signature-requests/${requestId}/signatures`)
        .set(HEADERS)
        .send({
          idSigner: IDS.signer3,
          idGroup: IDS.groupB,
          ipAddress: '10.0.0.2',
        })
        .expect(200);

      expect(res.body.data.isCompleted).toBe(false);
      expect(res.body.data.request.status).toBe('IN_PROGRESS');
      expect(res.body.data.remainingRequired).toBeDefined();
    });

    it('should complete after 2nd Manager signs', async () => {
      const res = await request(app.getHttpServer())
        .post(`/signature-requests/${requestId}/signatures`)
        .set(HEADERS)
        .send({
          idSigner: IDS.signer4,
          idGroup: IDS.groupB,
          ipAddress: '10.0.0.3',
        })
        .expect(200);

      expect(res.body.data.isCompleted).toBe(true);
      expect(res.body.data.request.status).toBe('COMPLETED');
    });
  });

  // ──────────────────────────────────────────────
  // Scenario: Complex rule — (1A AND 1B) OR 2C
  // ──────────────────────────────────────────────

  describe('Scenario: Complex rule (1A AND 1B) OR 2C', () => {
    let requestId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer()).post('/signature-requests').set(HEADERS).send({
        idAccount: IDS.account,
        idFaculty: IDS.faculty,
        idRule: IDS.rule2,
        referenceId: 'E2E-COMPLEX-001',
        referenceType: 'WIRE_TRANSFER',
      });
      requestId = res.body.data.id;
    });

    it('should NOT complete with only 1 Director', async () => {
      const res = await request(app.getHttpServer())
        .post(`/signature-requests/${requestId}/signatures`)
        .set(HEADERS)
        .send({ idSigner: IDS.signer1, idGroup: IDS.groupA })
        .expect(200);

      expect(res.body.data.isCompleted).toBe(false);
    });

    it('should complete with 1 Director + 1 Manager (1A AND 1B)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/signature-requests/${requestId}/signatures`)
        .set(HEADERS)
        .send({ idSigner: IDS.signer3, idGroup: IDS.groupB })
        .expect(200);

      expect(res.body.data.isCompleted).toBe(true);
      expect(res.body.data.request.status).toBe('COMPLETED');
    });
  });

  // ──────────────────────────────────────────────
  // Scenario: Cancel request
  // ──────────────────────────────────────────────

  describe('Scenario: Cancel request', () => {
    let requestId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer()).post('/signature-requests').set(HEADERS).send({
        idAccount: IDS.account,
        idFaculty: IDS.faculty,
        idRule: IDS.rule1,
        referenceId: 'E2E-CANCEL-001',
        referenceType: 'WIRE_TRANSFER',
      });
      requestId = res.body.data.id;
    });

    it('should cancel a CREATED request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/signature-requests/${requestId}/cancel`)
        .set(HEADERS)
        .expect(200);

      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('should reject adding signature to cancelled request', () => {
      return request(app.getHttpServer())
        .post(`/signature-requests/${requestId}/signatures`)
        .set(HEADERS)
        .send({ idSigner: IDS.signer1, idGroup: IDS.groupA })
        .expect(409);
    });

    it('should reject cancelling an already cancelled request', () => {
      return request(app.getHttpServer())
        .post(`/signature-requests/${requestId}/cancel`)
        .set(HEADERS)
        .expect(409);
    });
  });

  // ──────────────────────────────────────────────
  // Scenario: Duplicate signature prevention
  // ──────────────────────────────────────────────

  describe('Scenario: Duplicate signature prevention', () => {
    let requestId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer()).post('/signature-requests').set(HEADERS).send({
        idAccount: IDS.account,
        idFaculty: IDS.faculty,
        idRule: IDS.rule1,
        referenceId: 'E2E-DUPLICATE-001',
        referenceType: 'WIRE_TRANSFER',
      });
      requestId = res.body.data.id;
    });

    it('should accept first signature from signer', async () => {
      await request(app.getHttpServer())
        .post(`/signature-requests/${requestId}/signatures`)
        .set(HEADERS)
        .send({ idSigner: IDS.signer3, idGroup: IDS.groupB })
        .expect(200);
    });

    it('should reject duplicate signature from same signer', () => {
      return request(app.getHttpServer())
        .post(`/signature-requests/${requestId}/signatures`)
        .set(HEADERS)
        .send({ idSigner: IDS.signer3, idGroup: IDS.groupB })
        .expect(409);
    });
  });

  // ──────────────────────────────────────────────
  // Scenario: Cancel IN_PROGRESS & COMPLETED requests
  // ──────────────────────────────────────────────

  describe('Scenario: Cancel edge cases', () => {
    it('should cancel an IN_PROGRESS request', async () => {
      // Create request, add 1 signature (Manager → IN_PROGRESS for "1A OR 2B")
      const createRes = await request(app.getHttpServer())
        .post('/signature-requests')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          idFaculty: IDS.faculty,
          idRule: IDS.rule1,
          referenceId: 'E2E-CANCEL-INPROGRESS',
          referenceType: 'WIRE_TRANSFER',
        })
        .expect(201);

      const reqId = createRes.body.data.id;

      await request(app.getHttpServer())
        .post(`/signature-requests/${reqId}/signatures`)
        .set(HEADERS)
        .send({ idSigner: IDS.signer3, idGroup: IDS.groupB })
        .expect(200);

      // Now cancel
      const cancelRes = await request(app.getHttpServer())
        .post(`/signature-requests/${reqId}/cancel`)
        .set(HEADERS)
        .expect(200);

      expect(cancelRes.body.data.status).toBe('CANCELLED');
    });

    it('should reject cancelling a COMPLETED request', async () => {
      // Create request and complete it with 1 Director
      const createRes = await request(app.getHttpServer())
        .post('/signature-requests')
        .set(HEADERS)
        .send({
          idAccount: IDS.account,
          idFaculty: IDS.faculty,
          idRule: IDS.rule1,
          referenceId: 'E2E-CANCEL-COMPLETED',
          referenceType: 'WIRE_TRANSFER',
        })
        .expect(201);

      const reqId = createRes.body.data.id;

      await request(app.getHttpServer())
        .post(`/signature-requests/${reqId}/signatures`)
        .set(HEADERS)
        .send({ idSigner: IDS.signer1, idGroup: IDS.groupA })
        .expect(200);

      // Try to cancel completed → 409
      await request(app.getHttpServer())
        .post(`/signature-requests/${reqId}/cancel`)
        .set(HEADERS)
        .expect(409);
    });

    it('should 404 when cancelling non-existent request', () => {
      return request(app.getHttpServer())
        .post('/signature-requests/00000000-0000-4000-a000-999999999999/cancel')
        .set(HEADERS)
        .expect(404);
    });
  });

  // ──────────────────────────────────────────────
  // Validation & Error Handling
  // ──────────────────────────────────────────────

  describe('Validation & Error Handling', () => {
    it('should return 404 for non-existent signature request', () => {
      return request(app.getHttpServer())
        .get('/signature-requests/00000000-0000-4000-a000-999999999999')
        .set(HEADERS)
        .expect(404);
    });

    it('should return 404 when adding signature to non-existent request', () => {
      return request(app.getHttpServer())
        .post('/signature-requests/00000000-0000-4000-a000-999999999999/signatures')
        .set(HEADERS)
        .send({ idSigner: IDS.signer1, idGroup: IDS.groupA })
        .expect(404);
    });

    it('should return 400 for invalid body on create request', () => {
      return request(app.getHttpServer())
        .post('/signature-requests')
        .set(HEADERS)
        .send({ invalidField: 'test' })
        .expect(400);
    });

    it('should return 400 for non-UUID idAccount on create request', () => {
      return request(app.getHttpServer())
        .post('/signature-requests')
        .set(HEADERS)
        .send({
          idAccount: 'not-a-uuid',
          idFaculty: IDS.faculty,
          idRule: IDS.rule1,
        })
        .expect(400);
    });

    it('should return 400 for missing organization header', () => {
      return request(app.getHttpServer()).get(`/signature-rules/${IDS.rule1}`).expect(400);
    });
  });
});
