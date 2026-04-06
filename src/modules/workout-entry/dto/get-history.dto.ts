import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import type { PaginatedResult } from '@src/shared/types/api-response.type';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export interface HistorySetDisplay {
  reps: number;
  weight: number;
  unit: string;
}

export interface HistoryEntryDisplay {
  id: string;
  date: string;
  exerciseName: string;
  sets: HistorySetDisplay[];
}

export interface GetHistoryResult extends PaginatedResult<HistoryEntryDisplay> {}

export class GetHistoryDTO {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) =>
    value !== undefined && value !== null ? parseInt(String(value), 10) : 20,
  )
  limit: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;

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
  @IsString()
  muscleGroup?: string;

  @IsOptional()
  @IsEnum(WeightUnit)
  @Transform(({ value }) => value ?? WeightUnit.KG)
  unit: WeightUnit = WeightUnit.KG;
}
