import { fromKg, toKg, UNIT_TO_KG } from '@src/shared/units/unit-converter';

describe('UnitConverter', () => {
  describe('toKg()', () => {
    it('returns same value for kg input', () => {
      expect(toKg(100, 'kg')).toBe(100);
    });

    it('converts lb to kg correctly (220.46 lb ≈ 100 kg)', () => {
      expect(toKg(220.46, 'lb')).toBeCloseTo(100, 1);
    });

    it('converts 1 lb to 0.4536 kg', () => {
      expect(toKg(1, 'lb')).toBeCloseTo(0.4536, 3);
    });

    it('preserves at most 4 decimal places', () => {
      const result = toKg(2.5, 'lb');
      const decimalPart = result.toString().split('.')[1];
      const decimals = decimalPart !== undefined ? decimalPart.length : 0;
      expect(decimals).toBeLessThanOrEqual(4);
    });

    it('throws for unknown unit', () => {
      expect(() => toKg(100, 'stone')).toThrow('INVALID_UNIT');
    });
  });

  describe('fromKg()', () => {
    it('converts kg to lb correctly', () => {
      expect(fromKg(100, 'lb')).toBeCloseTo(220.46, 1);
    });

    it('returns same value for kg output', () => {
      expect(fromKg(100, 'kg')).toBe(100);
    });

    it('throws for unknown unit', () => {
      expect(() => fromKg(100, 'stone')).toThrow('INVALID_UNIT');
    });
  });

  describe('UNIT_TO_KG map', () => {
    it('contains kg with factor 1', () => {
      expect(UNIT_TO_KG).toHaveProperty('kg', 1);
    });

    it('contains lb', () => {
      expect(UNIT_TO_KG).toHaveProperty('lb');
    });
  });

  describe('Edge cases: zero weight', () => {
    it('toKg(0, "kg") returns 0', () => {
      expect(toKg(0, 'kg')).toBe(0);
    });

    it('toKg(0, "lb") returns 0', () => {
      expect(toKg(0, 'lb')).toBe(0);
    });

    it('fromKg(0, "kg") returns 0', () => {
      expect(fromKg(0, 'kg')).toBe(0);
    });

    it('fromKg(0, "lb") returns 0', () => {
      expect(fromKg(0, 'lb')).toBe(0);
    });
  });

  describe('Case sensitivity', () => {
    it('toKg(100, "KG") throws INVALID_UNIT (case sensitive)', () => {
      expect(() => toKg(100, 'KG')).toThrow('INVALID_UNIT');
    });

    it('toKg(100, "LB") throws INVALID_UNIT (case sensitive)', () => {
      expect(() => toKg(100, 'LB')).toThrow('INVALID_UNIT');
    });

    it('fromKg(100, "KG") throws INVALID_UNIT (case sensitive)', () => {
      expect(() => fromKg(100, 'KG')).toThrow('INVALID_UNIT');
    });
  });

  describe('Round-trip conversion', () => {
    it('round-trip: fromKg(toKg(100.5, "lb"), "lb") ≈ 100.5 (within 0.01)', () => {
      const converted = toKg(100.5, 'lb');
      const backToLb = fromKg(converted, 'lb');
      expect(backToLb).toBeCloseTo(100.5, 2);
    });

    it('round-trip: toKg(fromKg(50, "lb"), "lb") ≈ 50 (within 0.01)', () => {
      const converted = fromKg(50, 'lb');
      const backToKg = toKg(converted, 'lb');
      expect(backToKg).toBeCloseTo(50, 2);
    });
  });
});
