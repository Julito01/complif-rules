import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { Request, Response } from 'express';

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
  });

  function makeReqRes(headers: Record<string, string> = {}): {
    req: Partial<Request>;
    res: Partial<Response>;
  } {
    return {
      req: { headers: { ...headers } } as any,
      res: { setHeader: jest.fn() } as any,
    };
  }

  it('should use X-Request-ID header if provided', () => {
    const { req, res } = makeReqRes({ 'x-request-id': 'my-req-id' });
    middleware.use(req as any, res as any, next);
    expect(req.headers!['x-request-id']).toBe('my-req-id');
    expect((req as any).id).toBe('my-req-id');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'my-req-id');
    expect(next).toHaveBeenCalled();
  });

  it('should use X-Correlation-ID header as fallback', () => {
    const { req, res } = makeReqRes({ 'x-correlation-id': 'my-corr-id' });
    middleware.use(req as any, res as any, next);
    expect((req as any).id).toBe('my-corr-id');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'my-corr-id');
  });

  it('should generate UUID when no header is present', () => {
    const { req, res } = makeReqRes();
    middleware.use(req as any, res as any, next);

    const id = (req as any).id;
    expect(id).toBeDefined();
    // UUID v4 pattern
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', id);
    expect(next).toHaveBeenCalled();
  });

  it('should prefer X-Request-ID over X-Correlation-ID', () => {
    const { req, res } = makeReqRes({
      'x-request-id': 'req-id',
      'x-correlation-id': 'corr-id',
    });
    middleware.use(req as any, res as any, next);
    expect((req as any).id).toBe('req-id');
  });
});
