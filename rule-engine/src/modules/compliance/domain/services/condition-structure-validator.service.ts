import { ConditionNode } from '../value-objects/condition-node.vo';

const SUPPORTED_OPERATORS = new Set([
  'equal',
  'notEqual',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'in',
  'notIn',
  'contains',
  'notContains',
  'exists',
  'notExists',
  'between',
  'regex',
]);

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

export class ConditionStructureValidator {
  static validate(root: ConditionNode): ValidationResult {
    const errors: string[] = [];
    this.validateNode(root, 'conditions', errors);
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static validateNode(node: unknown, path: string, errors: string[]): void {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      errors.push(`${path}: node must be an object`);
      return;
    }

    const n = node as ConditionNode;
    const hasAll = n.all !== undefined;
    const hasAny = n.any !== undefined;
    const hasNot = n.not !== undefined;
    const hasLeafParts = n.fact !== undefined || n.operator !== undefined || n.value !== undefined;
    const isLeaf = n.fact !== undefined || n.operator !== undefined;

    const nodeKinds = [hasAll, hasAny, hasNot, isLeaf].filter(Boolean).length;
    if (nodeKinds !== 1) {
      errors.push(
        `${path}: node must define exactly one of all, any, not, or leaf (fact/operator/value)`,
      );
      return;
    }

    if (hasAll) {
      if (!Array.isArray(n.all) || n.all.length === 0) {
        errors.push(`${path}.all: must be a non-empty array`);
        return;
      }
      n.all.forEach((child, index) => {
        this.validateNode(child, `${path}.all[${index}]`, errors);
      });
      return;
    }

    if (hasAny) {
      if (!Array.isArray(n.any) || n.any.length === 0) {
        errors.push(`${path}.any: must be a non-empty array`);
        return;
      }
      n.any.forEach((child, index) => {
        this.validateNode(child, `${path}.any[${index}]`, errors);
      });
      return;
    }

    if (hasNot) {
      this.validateNode(n.not, `${path}.not`, errors);
      return;
    }

    if (hasLeafParts) {
      this.validateLeaf(n, path, errors);
    }
  }

  private static validateLeaf(node: ConditionNode, path: string, errors: string[]): void {
    if (!node.fact || typeof node.fact !== 'string') {
      errors.push(`${path}.fact: must be a non-empty string`);
    }

    if (!node.operator || typeof node.operator !== 'string') {
      errors.push(`${path}.operator: must be a non-empty string`);
      return;
    }

    if (!SUPPORTED_OPERATORS.has(node.operator)) {
      errors.push(`${path}.operator: unsupported operator "${node.operator}"`);
      return;
    }

    const value = node.value;

    if (node.operator === 'exists' || node.operator === 'notExists') {
      if (value !== undefined) {
        errors.push(`${path}.value: must be omitted for operator ${node.operator}`);
      }
      return;
    }

    if (node.operator === 'in' || node.operator === 'notIn') {
      if (!Array.isArray(value) || value.length === 0) {
        errors.push(`${path}.value: must be a non-empty array for operator ${node.operator}`);
      }
      return;
    }

    if (node.operator === 'between') {
      if (
        !Array.isArray(value) ||
        value.length !== 2 ||
        typeof value[0] !== 'number' ||
        typeof value[1] !== 'number'
      ) {
        errors.push(`${path}.value: must be [number, number] for operator between`);
      }
      return;
    }

    if (node.operator === 'regex') {
      if (typeof value !== 'string') {
        errors.push(`${path}.value: must be a string regex pattern`);
      }
      return;
    }

    if (
      node.operator === 'greaterThan' ||
      node.operator === 'greaterThanOrEqual' ||
      node.operator === 'lessThan' ||
      node.operator === 'lessThanOrEqual'
    ) {
      if (typeof value !== 'number') {
        errors.push(`${path}.value: must be a number for operator ${node.operator}`);
      }
      return;
    }

    if (node.operator === 'contains' || node.operator === 'notContains') {
      if (typeof value !== 'string') {
        errors.push(`${path}.value: must be a string for operator ${node.operator}`);
      }
      return;
    }

    if (value === undefined) {
      errors.push(`${path}.value: is required for operator ${node.operator}`);
    }
  }
}
