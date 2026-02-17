import { DomainExceptionFilter, ErrorResponse } from './domain-exception.filter';
import { DomainException } from '../exceptions';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import {
  EntityNotFoundException,
  InvalidStateException,
  BusinessRuleException,
  ValidationException,
  InactiveEntityException,
  OrganizationContextException,
  DuplicateOperationException,
} from '../exceptions/domain.exception';

describe('DomainExceptionFilter', () => {
  let filter: DomainExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new DomainExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = { url: '/test-path' };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  it('should handle DomainException (EntityNotFoundException)', () => {
    const exception = new EntityNotFoundException('Account', '123');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ENTITY_NOT_FOUND');
    expect(body.error.message).toContain('Account');
    expect(body.error.path).toBe('/test-path');
    expect(body.error.details).toBeDefined();
  });

  it('should handle DomainException (InvalidStateException)', () => {
    const exception = new InvalidStateException('Bad state', 'COMPLETED', ['CREATED']);
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('should handle DomainException (BusinessRuleException)', () => {
    const exception = new BusinessRuleException('Rule violated', 'MAX_AMOUNT');
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('should handle DomainException (ValidationException)', () => {
    const exception = new ValidationException('Invalid input', { name: ['required'] });
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('should handle DomainException (InactiveEntityException)', () => {
    const exception = new InactiveEntityException('Rule', 'abc');
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('should handle DomainException (OrganizationContextException)', () => {
    const exception = new OrganizationContextException();
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('should handle DomainException (DuplicateOperationException)', () => {
    const exception = new DuplicateOperationException('Duplicate', 'Sig', '1');
    filter.catch(exception, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('should handle HttpException with string response', () => {
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    const body: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Not found');
  });

  it('should handle HttpException with object response', () => {
    const exception = new HttpException(
      { message: 'Validation failed', errors: ['field required'] },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const body: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.message).toBe('Validation failed');
    expect(body.error.details).toBeDefined();
  });

  it('should handle HttpException with FORBIDDEN status', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    filter.catch(exception, mockHost);
    const body: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('should handle HttpException with UNAUTHORIZED status', () => {
    const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    filter.catch(exception, mockHost);
    const body: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should handle HttpException with CONFLICT status', () => {
    const exception = new HttpException('Conflict', HttpStatus.CONFLICT);
    filter.catch(exception, mockHost);
    const body: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(body.error.code).toBe('CONFLICT');
  });

  it('should handle HttpException with UNPROCESSABLE_ENTITY status', () => {
    const exception = new HttpException('Unprocessable', HttpStatus.UNPROCESSABLE_ENTITY);
    filter.catch(exception, mockHost);
    const body: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('should handle HttpException with INTERNAL_SERVER_ERROR status', () => {
    const exception = new HttpException('Internal', HttpStatus.INTERNAL_SERVER_ERROR);
    filter.catch(exception, mockHost);
    const body: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('should handle HttpException with unknown status returns UNKNOWN_ERROR', () => {
    const exception = new HttpException('Teapot', 418);
    filter.catch(exception, mockHost);
    const body: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(body.error.code).toBe('UNKNOWN_ERROR');
  });

  it('should handle unexpected Error', () => {
    const exception = new Error('Something broke');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Something broke');
  });

  it('should handle non-Error unexpected exception', () => {
    filter.catch('string error', mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body: ErrorResponse = mockResponse.json.mock.calls[0][0];
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
  });

  it('should mask message in production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      filter.catch(new Error('Sensitive details'), mockHost);
      const body: ErrorResponse = mockResponse.json.mock.calls[0][0];
      expect(body.error.message).toBe('An unexpected error occurred');
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
