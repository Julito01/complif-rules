import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { databaseConfig } from './config';
import { SignatureModule } from './modules/signature/signature.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CorrelationIdMiddleware } from './shared/middleware';
import { RedisCacheService } from './shared/cache';
import { MetricsService, MetricsController } from './shared/metrics';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
      envFilePath: ['.env', '.env.example'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Use request ID set by CorrelationIdMiddleware
        genReqId: (req) => (req as any).id,
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        // Redact sensitive headers
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            organizationId: req.headers?.['x-organization-id'],
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
        // Quieter health-check logs
        autoLogging: {
          ignore: (req) => (req as any).url === '/health',
        },
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
      }),
    }),
    SignatureModule,
    ComplianceModule,
  ],
  controllers: [AppController, MetricsController],
  providers: [AppService, RedisCacheService, MetricsService],
  exports: [RedisCacheService, MetricsService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
