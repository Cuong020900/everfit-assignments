import { GroupBy } from '@src/shared/enums/group-by.enum';
import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import type { ApiResult } from '@src/shared/types/api-response.type';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export interface ProgressPoint {
  period: string; // 'YYYY-MM-DD' | 'YYYY-Www' | 'YYYY-MM'
  bestWeight: number;
  volume: number;
  unit: string;
}

export interface ProgressData {
  series: ProgressPoint[];
  groupBy: GroupBy;
  note: string | null;
}

export interface GetProgressResult extends ApiResult<ProgressData> {}

export class GetProgressDTO {
  @IsUUID()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  exerciseName!: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(GroupBy)
  @Transform(({ value }) => value ?? GroupBy.DAILY)
  groupBy: GroupBy = GroupBy.DAILY;

  @IsOptional()
  @IsEnum(WeightUnit)
  @Transform(({ value }) => value ?? WeightUnit.KG)
  unit: WeightUnit = WeightUnit.KG;
}
