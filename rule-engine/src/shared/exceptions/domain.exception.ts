import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base class for all domain exceptions.
 * Provides consistent error structure across the application.
 */
export abstract class DomainException extends HttpException {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Record<string, unknown>,
  ) {
    super(
      {
        success: false,
        error: {
          code,
          message,
          details,
        },
      },
      status,
    );
    // HttpException sets this.message to the class name when response is an
    // object; override so .message carries the human-readable text.
    this.message = message;
    this.code = code;
    this.details = details;
  }
}

/**
 * Thrown when a requested entity is not found.
 */
export class EntityNotFoundException extends DomainException {
  constructor(entityName: string, id: string) {
    super(`${entityName} not found: ${id}`, 'ENTITY_NOT_FOUND', HttpStatus.NOT_FOUND, {
      entity: entityName,
      id,
    });
  }
}

/**
 * Thrown when a required resource does not exist.
 */
export class ResourceNotFoundException extends DomainException {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`, 'RESOURCE_NOT_FOUND', HttpStatus.NOT_FOUND, {
      resource,
      identifier,
    });
  }
}

/**
 * Thrown when an entity is in an invalid state for the requested operation.
 */
export class InvalidStateException extends DomainException {
  constructor(message: string, currentState?: string, expectedStates?: string[]) {
    super(message, 'INVALID_STATE', HttpStatus.CONFLICT, {
      currentState,
      expectedStates,
    });
  }
}

/**
 * Thrown when a business rule is violated.
 */
export class BusinessRuleException extends DomainException {
  constructor(message: string, rule?: string) {
    super(message, 'BUSINESS_RULE_VIOLATION', HttpStatus.UNPROCESSABLE_ENTITY, { rule });
  }
}

/**
 * Thrown when input validation fails.
 */
export class ValidationException extends DomainException {
  constructor(message: string, violations?: Record<string, string[]>) {
    super(message, 'VALIDATION_ERROR', HttpStatus.BAD_REQUEST, { violations });
  }
}

/**
 * Thrown when an entity is not active (e.g., disabled rule).
 */
export class InactiveEntityException extends DomainException {
  constructor(entityName: string, id: string) {
    super(`${entityName} is not active: ${id}`, 'ENTITY_INACTIVE', HttpStatus.CONFLICT, {
      entity: entityName,
      id,
    });
  }
}

/**
 * Thrown when organization context is missing or invalid.
 */
export class OrganizationContextException extends DomainException {
  constructor(message: string = 'Organization context is required') {
    super(message, 'ORGANIZATION_CONTEXT_REQUIRED', HttpStatus.BAD_REQUEST);
  }
}

/**
 * Thrown when a duplicate operation is attempted.
 */
export class DuplicateOperationException extends DomainException {
  constructor(message: string, entityName?: string, id?: string) {
    super(message, 'DUPLICATE_OPERATION', HttpStatus.CONFLICT, { entity: entityName, id });
  }
}
