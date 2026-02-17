import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './shared/filters';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Enable CORS for dashboard and WebSocket
  app.enableCors({ origin: '*' });

  // Replace default logger with Pino structured logger
  app.useLogger(app.get(Logger));

  // Global exception filter for standardized error responses
  app.useGlobalFilters(new DomainExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Swagger / OpenAPI ─────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Complif API')
    .setDescription(
      'Compliance rule engine with signature authorization. ' +
        'Part 0: Signature & Authorization module. ' +
        'Part 1: Rule Engine & Transaction Compliance module.',
    )
    .setVersion('1.0')
    .addGlobalParameters({
      name: 'x-organization-id',
      in: 'header',
      required: true,
      description: 'Multi-tenant organization identifier',
      schema: { type: 'string', example: 'complif-001' },
    })
    .addTag('Health', 'Health check and seeding')
    .addTag('Signature Requests', 'Create, sign, and cancel signature requests')
    .addTag('Signature Rules', 'CRUD for signature authorization rules')
    .addTag('Rule Templates', 'Compliance rule template management')
    .addTag('Rule Versions', 'Immutable rule version management')
    .addTag('Transactions', 'Transaction ingestion and evaluation')
    .addTag('Alerts', 'Compliance alert management')
    .addTag('Compliance Lists', 'Managed blacklists and whitelists for entity screening')
    .addTag('Observability', 'Prometheus metrics and health endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // ── Static files & Dashboard ──────────────────────────────────
  // Serve public/ folder for the UI dashboard
  // extensions: ['html'] allows /dashboard to resolve to dashboard.html
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    extensions: ['html'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Application running on port ${port}`, 'Bootstrap');
  logger.log(`Swagger UI available at http://localhost:${port}/api`, 'Bootstrap');
}
bootstrap();
