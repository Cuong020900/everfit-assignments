import { CompareTo } from '@src/shared/enums/compare-to.enum';
import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ description: 'User UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ description: 'Filter by exercise name', example: 'Bench Press' })
  @IsOptional()
  @IsString()
  exerciseName?: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)', example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Comparison period', enum: CompareTo })
  @IsOptional()
  @IsEnum(CompareTo)
  compareTo?: CompareTo;

  @ApiPropertyOptional({ description: 'Weight unit for response', enum: WeightUnit, default: WeightUnit.KG })
  @IsOptional()
  @IsEnum(WeightUnit)
  @Transform(({ value }) => value ?? WeightUnit.KG)
  unit: WeightUnit = WeightUnit.KG;
}
