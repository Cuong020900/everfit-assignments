export const UNIT_TO_KG = Object.freeze({ kg: 1, lb: 0.453592 } as const);

type Unit = keyof typeof UNIT_TO_KG;

function assertUnit(unit: string): asserts unit is Unit {
  if (!(unit in UNIT_TO_KG)) throw new Error('INVALID_UNIT');
}

export function toKg(value: number, unit: string): number {
  assertUnit(unit);
  return Math.round(value * UNIT_TO_KG[unit] * 10000) / 10000;
}

export function fromKg(valueKg: number, targetUnit: string): number {
  assertUnit(targetUnit);
  return Math.round((valueKg / UNIT_TO_KG[targetUnit]) * 10000) / 10000;
}
