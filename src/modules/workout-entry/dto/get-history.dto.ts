import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import type { PaginatedResult } from '@src/shared/types/api-response.type';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ description: 'User UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ description: 'Page size (1–100)', default: 20, example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) =>
    value !== undefined && value !== null ? parseInt(String(value), 10) : 20,
  )
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Pagination cursor from previous response' })
  @IsOptional()
  @IsString()
  cursor?: string;

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

  @ApiPropertyOptional({ description: 'Filter by muscle group', example: 'push' })
  @IsOptional()
  @IsString()
  muscleGroup?: string;

  @ApiPropertyOptional({ description: 'Weight unit for response', enum: WeightUnit, default: WeightUnit.KG })
  @IsOptional()
  @IsEnum(WeightUnit)
  @Transform(({ value }) => value ?? WeightUnit.KG)
  unit: WeightUnit = WeightUnit.KG;
}
