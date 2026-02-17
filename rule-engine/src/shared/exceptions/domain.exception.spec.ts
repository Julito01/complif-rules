import { HttpStatus } from '@nestjs/common';
import {
  EntityNotFoundException,
  ResourceNotFoundException,
  InvalidStateException,
  BusinessRuleException,
  ValidationException,
  InactiveEntityException,
  OrganizationContextException,
  DuplicateOperationException,
} from './domain.exception';

describe('Domain Exceptions', () => {
  it('EntityNotFoundException', () => {
    const ex = new EntityNotFoundException('User', '42');
    expect(ex.code).toBe('ENTITY_NOT_FOUND');
    expect(ex.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(ex.details).toEqual({ entity: 'User', id: '42' });
    expect(ex.message).toContain('User');
  });

  it('ResourceNotFoundException', () => {
    const ex = new ResourceNotFoundException('File', 'path.txt');
    expect(ex.code).toBe('RESOURCE_NOT_FOUND');
    expect(ex.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(ex.details).toEqual({ resource: 'File', identifier: 'path.txt' });
  });

  it('InvalidStateException with optional params', () => {
    const ex = new InvalidStateException('Bad state', 'COMPLETED', ['CREATED', 'IN_PROGRESS']);
    expect(ex.code).toBe('INVALID_STATE');
    expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(ex.details?.currentState).toBe('COMPLETED');
    expect(ex.details?.expectedStates).toEqual(['CREATED', 'IN_PROGRESS']);
  });

  it('InvalidStateException without optional params', () => {
    const ex = new InvalidStateException('Bad state');
    expect(ex.details?.currentState).toBeUndefined();
  });

  it('BusinessRuleException', () => {
    const ex = new BusinessRuleException('Too many', 'MAX_LIMIT');
    expect(ex.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(ex.details?.rule).toBe('MAX_LIMIT');
  });

  it('BusinessRuleException without rule', () => {
    const ex = new BusinessRuleException('Too many');
    expect(ex.details?.rule).toBeUndefined();
  });

  it('ValidationException', () => {
    const ex = new ValidationException('Invalid', { name: ['required'] });
    expect(ex.code).toBe('VALIDATION_ERROR');
    expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('InactiveEntityException', () => {
    const ex = new InactiveEntityException('Rule', 'abc');
    expect(ex.code).toBe('ENTITY_INACTIVE');
    expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
  });

  it('OrganizationContextException with default message', () => {
    const ex = new OrganizationContextException();
    expect(ex.code).toBe('ORGANIZATION_CONTEXT_REQUIRED');
    expect(ex.message).toContain('Organization context');
  });

  it('OrganizationContextException with custom message', () => {
    const ex = new OrganizationContextException('Custom msg');
    expect(ex.message).toContain('Custom msg');
  });

  it('DuplicateOperationException', () => {
    const ex = new DuplicateOperationException('Already exists', 'Sig', '1');
    expect(ex.code).toBe('DUPLICATE_OPERATION');
    expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(ex.details?.entity).toBe('Sig');
  });

  it('DuplicateOperationException without entity', () => {
    const ex = new DuplicateOperationException('Already exists');
    expect(ex.details?.entity).toBeUndefined();
  });
});
