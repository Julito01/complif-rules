import { EvaluationGateway } from './evaluation.gateway';

describe('EvaluationGateway', () => {
  let gateway: EvaluationGateway;

  beforeEach(() => {
    gateway = new EvaluationGateway();
    // Mock the server
    (gateway as any).server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should log client connection', () => {
      const mockClient = { id: 'test-client-1' } as any;
      expect(() => gateway.handleConnection(mockClient)).not.toThrow();
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnection', () => {
      const mockClient = { id: 'test-client-1' } as any;
      expect(() => gateway.handleDisconnect(mockClient)).not.toThrow();
    });
  });

  describe('handleSubscribe', () => {
    it('should join client to organization room', () => {
      const mockClient = { id: 'test-1', join: jest.fn() } as any;
      const result = gateway.handleSubscribe(mockClient, { organizationId: 'org-1' });

      expect(mockClient.join).toHaveBeenCalledWith('org:org-1');
      expect(result).toEqual({
        event: 'subscribed',
        data: { subscribed: true, organizationId: 'org-1' },
      });
    });

    it('should return error if organizationId is missing', () => {
      const mockClient = { id: 'test-1', join: jest.fn() } as any;
      const result = gateway.handleSubscribe(mockClient, { organizationId: '' });

      expect(mockClient.join).not.toHaveBeenCalled();
      expect(result.event).toBe('error');
    });
  });

  describe('handleUnsubscribe', () => {
    it('should leave client from organization room', () => {
      const mockClient = { id: 'test-1', leave: jest.fn() } as any;
      const result = gateway.handleUnsubscribe(mockClient, { organizationId: 'org-1' });

      expect(mockClient.leave).toHaveBeenCalledWith('org:org-1');
      expect(result).toEqual({
        event: 'unsubscribed',
        data: { unsubscribed: true },
      });
    });
  });

  describe('emitEvaluationResult', () => {
    it('should emit to organization room', () => {
      const event = {
        transactionId: 'txn-1',
        accountId: 'acc-1',
        decision: 'ALLOW',
        triggeredRulesCount: 0,
        totalRulesEvaluated: 3,
        evaluationDurationMs: 12,
        timestamp: new Date().toISOString(),
      };

      gateway.emitEvaluationResult('org-1', event);

      expect((gateway as any).server.to).toHaveBeenCalledWith('org:org-1');
      expect((gateway as any).server.emit).toHaveBeenCalledWith('evaluation:result', event);
    });

    it('should not throw if server is null', () => {
      (gateway as any).server = null;
      expect(() => gateway.emitEvaluationResult('org-1', {} as any)).not.toThrow();
    });
  });

  describe('emitAlert', () => {
    it('should emit alert to organization room', () => {
      const alert = {
        alertId: 'alert-1',
        transactionId: 'txn-1',
        severity: 'HIGH',
        category: 'AML',
        message: 'Suspicious transaction',
        timestamp: new Date().toISOString(),
      };

      gateway.emitAlert('org-1', alert);

      expect((gateway as any).server.to).toHaveBeenCalledWith('org:org-1');
      expect((gateway as any).server.emit).toHaveBeenCalledWith('evaluation:alert', alert);
    });
  });

  describe('emitMetrics', () => {
    it('should broadcast metrics to all clients', () => {
      const metrics = {
        throughput: 85,
        avgLatencyMs: 12,
        cacheHitRate: '92%',
        activeConnections: 5,
        timestamp: new Date().toISOString(),
      };

      gateway.emitMetrics(metrics);

      expect((gateway as any).server.emit).toHaveBeenCalledWith('evaluation:metrics', metrics);
    });
  });
});
