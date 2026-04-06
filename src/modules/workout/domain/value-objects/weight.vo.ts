import { fromKg, toKg } from '@src/shared/units/unit-converter';

export class Weight {
  constructor(
    readonly value: number,
    readonly unit: string,
  ) {
    if (value <= 0) throw new Error('INVALID_WEIGHT');
    // validates unit is known — throws INVALID_UNIT if not
    toKg(value, unit);
  }

  toKg(): number {
    return toKg(this.value, this.unit);
  }

  convertTo(targetUnit: string): number {
    return fromKg(this.toKg(), targetUnit);
  }
}
