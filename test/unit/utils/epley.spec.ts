import { epley1RM } from '@src/shared/utils/epley';

describe('epley1RM()', () => {
  it('computes weight * (1 + reps/30)', () => {
    expect(epley1RM(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 4);
  });

  it('100 kg × 5 reps = 116.6667 kg', () => {
    expect(epley1RM(100, 5)).toBeCloseTo(116.6667, 2);
  });

  it('returns weight itself when reps = 1 (near no amplification)', () => {
    expect(epley1RM(100, 1)).toBeCloseTo(103.3333, 2);
  });

  it('rounds to 4 decimal places', () => {
    const result = epley1RM(100, 7);
    const decimals = result.toString().split('.')[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(4);
  });
});
