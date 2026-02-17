import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordEvaluation', () => {
    it('should record evaluation without throwing', () => {
      expect(() => service.recordEvaluation('org-1', 'ALLOW', 15, 'CASH_IN')).not.toThrow();
    });

    it('should record multiple evaluations with different decisions', () => {
      service.recordEvaluation('org-1', 'ALLOW', 10, 'CASH_IN');
      service.recordEvaluation('org-1', 'BLOCK', 50, 'CASH_OUT');
      service.recordEvaluation('org-1', 'REVIEW', 30, 'TRANSFER');
      // If no error thrown, metrics recorded successfully
    });
  });

  describe('recordAlert', () => {
    it('should record alert without throwing', () => {
      expect(() => service.recordAlert('org-1', 'HIGH', 'AML')).not.toThrow();
    });
  });

  describe('recordCacheHit / recordCacheMiss', () => {
    it('should record cache hits', () => {
      expect(() => service.recordCacheHit('rules')).not.toThrow();
    });

    it('should record cache misses', () => {
      expect(() => service.recordCacheMiss('rules')).not.toThrow();
    });
  });

  describe('setActiveRulesCount', () => {
    it('should set active rules gauge', () => {
      expect(() => service.setActiveRulesCount('org-1', 5)).not.toThrow();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics in Prometheus text format', async () => {
      service.recordEvaluation('org-1', 'ALLOW', 15, 'CASH_IN');
      const metrics = await service.getMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('complif_evaluation_duration_ms');
      expect(metrics).toContain('complif_transactions_total');
      expect(metrics).toContain('complif_evaluation_decisions_total');
    });

    it('should include default Node.js metrics', async () => {
      const metrics = await service.getMetrics();
      expect(metrics).toContain('complif_process_');
    });
  });

  describe('getContentType', () => {
    it('should return Prometheus content type', () => {
      const ct = service.getContentType();
      expect(ct).toContain('text/plain');
    });
  });
});
