import { fromKg, toKg, UNIT_TO_KG } from '../../../src/shared/units/unit-converter';

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
});
