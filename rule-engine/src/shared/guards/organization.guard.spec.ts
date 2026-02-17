import { OrganizationGuard } from './organization.guard';
import { ExecutionContext } from '@nestjs/common';
import { OrganizationContextException } from '../exceptions';

function mockContext(headers: Record<string, string> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as any;
}

describe('OrganizationGuard', () => {
  const guard = new OrganizationGuard();

  it('should allow request with x-organization-id header', () => {
    const ctx = mockContext({ 'x-organization-id': 'org-1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should attach organization context to request', () => {
    const req = { headers: { 'x-organization-id': 'org-1', 'x-user-id': 'user-1' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as any;
    guard.canActivate(ctx);
    expect((req as any).organizationContext).toEqual({
      organizationId: 'org-1',
      userId: 'user-1',
    });
  });

  it('should attach organization context without user id', () => {
    const req = { headers: { 'x-organization-id': 'org-1' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as any;
    guard.canActivate(ctx);
    expect((req as any).organizationContext.organizationId).toBe('org-1');
    expect((req as any).organizationContext.userId).toBeUndefined();
  });

  it('should throw OrganizationContextException when header is missing', () => {
    const ctx = mockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(OrganizationContextException);
  });

  it('should throw when header is empty string', () => {
    const ctx = mockContext({ 'x-organization-id': '' });
    expect(() => guard.canActivate(ctx)).toThrow(OrganizationContextException);
  });
});
