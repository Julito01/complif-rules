/**
 * Combined Jest config that runs BOTH unit tests and e2e tests
 * with coverage collection. Requires a running PostgreSQL instance.
 *
 * Usage:  npx jest --config jest-coverage.config.js
 * Script: npm run test:cov:all
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',

  // Match both *.spec.ts (unit) and *.e2e-spec.ts (e2e)
  testRegex: '(\\.spec\\.ts|\\.e2e-spec\\.ts)$',

  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // Collect coverage from all source files
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.(t|j)s'],

  // Exclude non-critical files from coverage measurement
  coveragePathIgnorePatterns: [
    '/node_modules/',
    'src/main\\.ts', // Bootstrap — not unit-testable
    'src/database/', // Seed scripts
    '.*\\.module\\.ts$', // NestJS module wiring
    '.*\\.dto\\.ts$', // DTOs — class declarations with decorators
    '.*/index\\.ts$', // Barrel re-exports
  ],

  coverageDirectory: 'coverage',

  coverageReporters: ['text', 'text-summary', 'lcov', 'json-summary'],

  // Enforce 80 % threshold on critical code
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Run tests sequentially — e2e tests share a DB
  maxWorkers: 1,
};
