import { CompareTo } from '@src/shared/enums/compare-to.enum';
import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export interface PRValue {
  value: number;
  unit: string;
  reps: number;
  achievedAt: string; // YYYY-MM-DD
}

export interface PRSet {
  maxWeight: PRValue | null;
  maxVolume: PRValue | null;
  bestOneRM: PRValue | null;
}

export interface ComparisonValue {
  current: number;
  previous: number;
  deltaKg: number;
  deltaPct: number;
}

export interface PRComparison {
  period: { from: string; to: string };
  prevPeriod: { from: string; to: string };
  maxWeight?: ComparisonValue;
  maxVolume?: ComparisonValue;
  bestOneRM?: ComparisonValue;
}

export interface PRExerciseResult {
  exerciseName: string;
  prs: PRSet;
  comparison?: PRComparison;
}

export interface GetPRResult {
  data: PRExerciseResult[];
}

export class GetPRDTO {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsString()
  exerciseName?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(CompareTo)
  compareTo?: CompareTo;

  @IsOptional()
  @IsEnum(WeightUnit)
  @Transform(({ value }) => value ?? WeightUnit.KG)
  unit: WeightUnit = WeightUnit.KG;
}
