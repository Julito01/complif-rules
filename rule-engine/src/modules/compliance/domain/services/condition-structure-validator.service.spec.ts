import { ConditionStructureValidator } from './condition-structure-validator.service';

describe('ConditionStructureValidator', () => {
  it('accepts valid leaf node', () => {
    const result = ConditionStructureValidator.validate({
      fact: 'transaction.amount',
      operator: 'greaterThan',
      value: 1000,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts valid nested combinators', () => {
    const result = ConditionStructureValidator.validate({
      all: [
        { fact: 'transaction.amount', operator: 'greaterThan', value: 5000 },
        {
          any: [
            { fact: 'transaction.country', operator: 'notIn', value: ['AR', 'UY'] },
            { not: { fact: 'account.risk_score', operator: 'lessThan', value: 70 } },
          ],
        },
      ],
    });

    expect(result.valid).toBe(true);
  });

  it('rejects node with multiple kinds at same level', () => {
    const result = ConditionStructureValidator.validate({
      all: [{ fact: 'transaction.amount', operator: 'greaterThan', value: 1 }],
      fact: 'transaction.type',
      operator: 'equal',
      value: 'CASH_IN',
    } as any);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('exactly one of all, any, not, or leaf');
  });

  it('rejects empty all/any arrays', () => {
    const allResult = ConditionStructureValidator.validate({ all: [] });
    const anyResult = ConditionStructureValidator.validate({ any: [] });

    expect(allResult.valid).toBe(false);
    expect(allResult.errors[0]).toContain('conditions.all: must be a non-empty array');

    expect(anyResult.valid).toBe(false);
    expect(anyResult.errors[0]).toContain('conditions.any: must be a non-empty array');
  });

  it('rejects unsupported operators', () => {
    const result = ConditionStructureValidator.validate({
      fact: 'transaction.amount',
      operator: 'gt',
      value: 10,
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('unsupported operator "gt"');
  });

  it('validates operator-specific value requirements', () => {
    const betweenBad = ConditionStructureValidator.validate({
      fact: 'transaction.amount',
      operator: 'between',
      value: [1],
    });

    const regexBad = ConditionStructureValidator.validate({
      fact: 'transaction.channel',
      operator: 'regex',
      value: 123,
    } as any);

    const existsBad = ConditionStructureValidator.validate({
      fact: 'transaction.country',
      operator: 'exists',
      value: true,
    } as any);

    expect(betweenBad.valid).toBe(false);
    expect(betweenBad.errors[0]).toContain('must be [number, number]');

    expect(regexBad.valid).toBe(false);
    expect(regexBad.errors[0]).toContain('must be a string regex pattern');

    expect(existsBad.valid).toBe(false);
    expect(existsBad.errors[0]).toContain('must be omitted for operator exists');
  });

  it('returns paths to nested errors', () => {
    const result = ConditionStructureValidator.validate({
      all: [
        { fact: 'transaction.amount', operator: 'greaterThan', value: 100 },
        {
          any: [
            { fact: 'transaction.country', operator: 'in', value: [] },
            { fact: 'transaction.type', operator: 'equal' },
          ],
        },
      ],
    } as any);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('conditions.all[1].any[0].value'),
        expect.stringContaining('conditions.all[1].any[1].value'),
      ]),
    );
  });
});
