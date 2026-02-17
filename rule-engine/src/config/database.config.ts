import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';

export default registerAs(
  'database',
  (): DataSourceOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'complif',
    password: process.env.DB_PASSWORD || 'complif',
    database: process.env.DB_NAME || 'complif',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize:
      process.env.TYPEORM_SYNCHRONIZE === 'true' || process.env.NODE_ENV !== 'production',
    logging: process.env.DB_LOGGING === 'true',
    // ─── Connection pool tuning ──────────────────────────────────
    // Default was 10, which starves under 20+ concurrent requests.
    // Each ingestAndEvaluate call holds a connection for the full
    // transaction lifetime, so pool must exceed max concurrency.
    extra: {
      max: parseInt(process.env.DB_POOL_SIZE || '50', 10),
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    },
  }),
);
