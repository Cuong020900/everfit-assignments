import { GroupBy } from '@src/shared/enums/group-by.enum';
import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
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
