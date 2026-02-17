-- =====================================================
-- Complif Rule Engine - Database Initialization Script
-- Part 0: Electronic Signature Module
-- =====================================================
-- NOTE: Tables are created by TypeORM with synchronize: true
-- This script only enables the UUID extension.
-- Seed data is inserted via: npm run seed
-- =====================================================

-- Enable UUID extension (required for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Partial unique indexes (not supported by TypeORM synchronize)
-- =====================================================

-- Enforce: only one active rule version per template at a time
-- Deferred to after TypeORM creates the tables via synchronize: true.
-- If tables don't exist yet, these statements are harmless (CREATE INDEX IF NOT EXISTS).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rule_versions') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rule_version_one_active_per_template
      ON rule_versions (id_rule_template)
      WHERE deactivated_at IS NULL;
  END IF;
END $$;
