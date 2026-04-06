import { CompareTo } from '@src/shared/enums/compare-to.enum';
import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import type { ApiResult } from '@src/shared/types/api-response.type';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export interface PRRecord {
  weight: number;
  unit: string;
  date: string;
}

export interface VolumeRecord extends PRRecord {
  reps: number;
}

export interface OneRMRecord {
  estimated1RM: number;
  unit: string;
  date: string;
}

export interface PRData {
  maxWeight: PRRecord | null;
  maxVolume: VolumeRecord | null;
  best1RM: OneRMRecord | null;
  previous?: PRData | null;
}

export interface GetPRResult extends ApiResult<PRData> {}

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
  unit: WeightUnit = WeightUnit.KG;
}
