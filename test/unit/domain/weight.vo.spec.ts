import { Weight } from '../../../src/modules/workout/domain/value-objects/weight.vo';

describe('Weight value object', () => {
  it('creates a Weight with value and unit', () => {
    const w = new Weight(100, 'kg');
    expect(w.value).toBe(100);
    expect(w.unit).toBe('kg');
  });

  it('toKg() returns same value for kg', () => {
    expect(new Weight(100, 'kg').toKg()).toBe(100);
  });

  it('toKg() converts lb to kg', () => {
    expect(new Weight(220.46, 'lb').toKg()).toBeCloseTo(100, 1);
  });

  it('convertTo("lb") converts from kg', () => {
    const w = new Weight(100, 'kg');
    expect(w.convertTo('lb')).toBeCloseTo(220.46, 1);
  });

  it('throws for unsupported unit', () => {
    expect(() => new Weight(100, 'stone')).toThrow('INVALID_UNIT');
  });

  it('throws for weight <= 0', () => {
    expect(() => new Weight(0, 'kg')).toThrow('INVALID_WEIGHT');
    expect(() => new Weight(-5, 'kg')).toThrow('INVALID_WEIGHT');
  });
});
