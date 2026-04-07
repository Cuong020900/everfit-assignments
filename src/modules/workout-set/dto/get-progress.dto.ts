import { GroupBy } from '@src/shared/enums/group-by.enum';
import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export interface ProgressPoint {
  period: string;
  bestWeight: number;
  volume: number;
}

export interface GetProgressResult {
  exerciseName: string;
  groupBy: string;
  unit: string;
  data: ProgressPoint[];
  insufficientData: boolean;
}

export class GetProgressDTO {
  @ApiProperty({ description: 'User UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Exercise name', example: 'Bench Press' })
  @IsString()
  @IsNotEmpty()
  exerciseName!: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)', example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Aggregation granularity', enum: GroupBy, default: GroupBy.WEEKLY })
  @IsOptional()
  @IsEnum(GroupBy)
  @Transform(({ value }) => value ?? GroupBy.WEEKLY)
  groupBy: GroupBy = GroupBy.WEEKLY;

  @ApiPropertyOptional({ description: 'Weight unit for response', enum: WeightUnit, default: WeightUnit.KG })
  @IsOptional()
  @IsEnum(WeightUnit)
  @Transform(({ value }) => value ?? WeightUnit.KG)
  unit: WeightUnit = WeightUnit.KG;
}
