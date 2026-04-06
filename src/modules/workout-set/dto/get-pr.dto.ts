import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

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
  @IsEnum(['previousPeriod'])
  compareTo?: 'previousPeriod';

  @IsOptional()
  @IsEnum(['kg', 'lb'])
  unit: 'kg' | 'lb' = 'kg';
}
