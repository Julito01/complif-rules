import { DataSource } from 'typeorm';

/**
 * Idempotent seed script for signature + compliance modules.
 * Uses fixed deterministic UUIDs so Postman variables can be pre-filled.
 * Safe to run on every container start — uses ON CONFLICT DO NOTHING.
 *
 * Run with: npx ts-node src/database/seeds/seed.ts
 */

const ORG_ID = 'complif-001';

// ── Fixed deterministic UUIDs ────────────────────────────────────────────
const IDS = {
  account: '00000000-0000-4000-a000-000000000001',
  faculty: '00000000-0000-4000-a000-000000000002',
  schema: '00000000-0000-4000-a000-000000000003',
  groupA: '00000000-0000-4000-a000-000000000010',
  groupB: '00000000-0000-4000-a000-000000000011',
  groupC: '00000000-0000-4000-a000-000000000012',
  signer1: '00000000-0000-4000-a000-000000000020', // Director 1
  signer2: '00000000-0000-4000-a000-000000000021', // Director 2
  signer3: '00000000-0000-4000-a000-000000000022', // Manager 1
  signer4: '00000000-0000-4000-a000-000000000023', // Manager 2
  signer5: '00000000-0000-4000-a000-000000000024', // Officer
  rule1: '00000000-0000-4000-a000-000000000030', // Simple: 1A OR 2B
  rule2: '00000000-0000-4000-a000-000000000031', // Complex: (1A AND 1B) OR 2C
  // Compliance module IDs
  ruleTemplate1: '00000000-0000-4000-b000-000000000001', // High-amount threshold
  ruleTemplate2: '00000000-0000-4000-b000-000000000002', // Velocity check
  ruleVersion1: '00000000-0000-4000-b000-000000000010',
  ruleVersion2: '00000000-0000-4000-b000-000000000011',
} as const;

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'complif',
    password: process.env.DB_PASSWORD || 'complif',
    database: process.env.DB_NAME || 'complif',
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  console.log('Database connected');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // 1. Account
    await queryRunner.query(
      `INSERT INTO accounts (id, id_organization, name, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [IDS.account, ORG_ID, 'Test Company S.A.'],
    );

    // 2. Faculty
    await queryRunner.query(
      `INSERT INTO faculties (id, id_organization, code, name, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        IDS.faculty,
        ORG_ID,
        'APPROVE_WIRE',
        'Approve Wire Transfer',
        'Authorization for wire transfer approvals',
      ],
    );

    // 3. Signature Schema
    await queryRunner.query(
      `INSERT INTO signature_schemas (id, id_organization, id_account, name, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [IDS.schema, ORG_ID, IDS.account, 'Payment Authorization Schema'],
    );

    // 4. Signer Groups
    await queryRunner.query(
      `INSERT INTO signer_groups (id, id_organization, id_signature_schema, code, name, description, priority, created_at, updated_at)
       VALUES 
         ($1, $2, $3, 'A', 'Directors', 'Board of Directors', 0, NOW(), NOW()),
         ($4, $2, $3, 'B', 'Managers', 'Department Managers', 0, NOW(), NOW()),
         ($5, $2, $3, 'C', 'Officers', 'Compliance Officers', 0, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [IDS.groupA, ORG_ID, IDS.schema, IDS.groupB, IDS.groupC],
    );

    // 5. Signers
    await queryRunner.query(
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

    // 6. Signer ↔ Group associations
    await queryRunner.query(
      `INSERT INTO signer_group_members (id_group, id_signer)
       VALUES 
         ($1, $2), ($1, $3),
         ($4, $5), ($4, $6),
         ($7, $8)
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

    // 7. Signature Rules
    const ruleDefinition1 = {
      any: [
        { group: 'A', min: 1 },
        { group: 'B', min: 2 },
      ],
    };

    const ruleDefinition2 = {
      any: [
        {
          all: [
            { group: 'A', min: 1 },
            { group: 'B', min: 1 },
          ],
        },
        { group: 'C', min: 2 },
      ],
    };

    await queryRunner.query(
      `INSERT INTO signature_rules (id, id_organization, id_signature_schema, id_faculty, name, description, rule_definition, is_active, priority, created_at, updated_at)
       VALUES 
         ($1, $2, $3, $4, 'Simple Wire Approval', '1 Director OR 2 Managers', $5, true, 0, NOW(), NOW()),
         ($6, $2, $3, $4, 'Complex Wire Approval', '(1 Director AND 1 Manager) OR 2 Officers', $7, true, 0, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        IDS.rule1,
        ORG_ID,
        IDS.schema,
        IDS.faculty,
        JSON.stringify(ruleDefinition1),
        IDS.rule2,
        JSON.stringify(ruleDefinition2),
      ],
    );

    // ── Compliance Module Seed Data ──────────────────────────────────

    // 8. Rule Templates
    await queryRunner.query(
      `INSERT INTO rule_templates (id, id_organization, code, name, description, category, is_active, is_system, created_at, updated_at)
       VALUES 
         ($1, $2, 'HIGH_AMOUNT', 'High Amount Transaction', 'Flags transactions above threshold', 'AML', true, true, NOW(), NOW()),
         ($3, $2, 'VELOCITY_CHECK', 'Transaction Velocity', 'Flags accounts with high transaction frequency', 'FRAUD', true, false, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [IDS.ruleTemplate1, ORG_ID, IDS.ruleTemplate2],
    );

    // 9. Rule Versions (immutable)
    const highAmountConditions = {
      all: [
        { fact: 'transaction.amount', operator: 'greaterThan', value: 10000 },
        { fact: 'transaction.type', operator: 'in', value: ['CASH_OUT', 'DEBIT'] },
      ],
    };

    const highAmountActions = [
      {
        type: 'create_alert',
        severity: 'HIGH',
        category: 'AML',
        message: 'High amount transaction detected',
      },
    ];

    const velocityConditions = {
      all: [{ fact: 'aggregation.count_24hours', operator: 'greaterThan', value: 5 }],
    };

    const velocityActions = [
      {
        type: 'create_alert',
        severity: 'MEDIUM',
        category: 'FRAUD',
        message: 'High transaction velocity detected',
      },
    ];

    const velocityWindow = { duration: 24, unit: 'hours' };

    await queryRunner.query(
      `INSERT INTO rule_versions (id, id_organization, id_rule_template, version_number, conditions, actions, "window", priority, enabled, activated_at, created_at, updated_at)
       VALUES 
         ($1, $2, $3, 1, $4, $5, NULL, 10, true, NOW(), NOW(), NOW()),
         ($6, $2, $7, 1, $8, $9, $10, 20, true, NOW(), NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        IDS.ruleVersion1,
        ORG_ID,
        IDS.ruleTemplate1,
        JSON.stringify(highAmountConditions),
        JSON.stringify(highAmountActions),
        IDS.ruleVersion2,
        IDS.ruleTemplate2,
        JSON.stringify(velocityConditions),
        JSON.stringify(velocityActions),
        JSON.stringify(velocityWindow),
      ],
    );

    await queryRunner.commitTransaction();
    console.log('\n✅ Seed completed (idempotent — safe to re-run).\n');

    console.log('='.repeat(60));
    console.log('TEST DATA — Pre-filled in Postman collection:');
    console.log('='.repeat(60));
    console.log(`  Organization:  ${ORG_ID}`);
    console.log(`  Account:       ${IDS.account}`);
    console.log(`  Faculty:       ${IDS.faculty}`);
    console.log(`  Schema:        ${IDS.schema}`);
    console.log(`  Group A:       ${IDS.groupA}`);
    console.log(`  Group B:       ${IDS.groupB}`);
    console.log(`  Group C:       ${IDS.groupC}`);
    console.log(`  Signer 1 (Director):  ${IDS.signer1}`);
    console.log(`  Signer 2 (Director):  ${IDS.signer2}`);
    console.log(`  Signer 3 (Manager):   ${IDS.signer3}`);
    console.log(`  Signer 4 (Manager):   ${IDS.signer4}`);
    console.log(`  Signer 5 (Officer):   ${IDS.signer5}`);
    console.log(`  Rule 1 (1A OR 2B):    ${IDS.rule1}`);
    console.log(`  Rule 2 ((1A∧1B)∨2C):  ${IDS.rule2}`);
    console.log('--- Compliance Module ---');
    console.log(`  Rule Template 1 (High Amount):  ${IDS.ruleTemplate1}`);
    console.log(`  Rule Template 2 (Velocity):     ${IDS.ruleTemplate2}`);
    console.log(`  Rule Version 1:                 ${IDS.ruleVersion1}`);
    console.log(`  Rule Version 2:                 ${IDS.ruleVersion2}`);
    console.log('='.repeat(60));
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Seed failed:', error);
    throw error;
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

seed().catch(console.error);
