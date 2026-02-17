import { Injectable, CanActivate, ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { OrganizationContextException } from '../exceptions';

/**
 * Organization context extracted from request headers.
 */
export interface OrganizationContext {
  organizationId: string;
  userId?: string;
}

/**
 * Guard that validates organization context is present in request headers.
 * Ensures multi-tenant isolation by requiring x-organization-id header.
 *
 * Usage:
 * @UseGuards(OrganizationGuard)
 * @Controller('my-resource')
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const organizationId = request.headers['x-organization-id'] as string;

    if (!organizationId) {
      throw new OrganizationContextException('x-organization-id header is required');
    }

    // Attach organization context to request for later use
    (request as any).organizationContext = {
      organizationId,
      userId: request.headers['x-user-id'] as string | undefined,
    };

    return true;
  }
}

/**
 * Parameter decorator to extract organization context from request.
 *
 * Usage:
 * @Get()
 * findAll(@OrgContext() ctx: OrganizationContext) {
 *   // ctx.organizationId is guaranteed to be present
 * }
 */
export const OrgContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): OrganizationContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const organizationId = request.headers['x-organization-id'] as string;
    const userId = request.headers['x-user-id'] as string | undefined;

    return {
      organizationId,
      userId,
    };
  },
);
