import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

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
  @IsEnum(['daily', 'weekly', 'monthly'])
  groupBy: 'daily' | 'weekly' | 'monthly' = 'daily';

  @IsOptional()
  @IsEnum(['kg', 'lb'])
  unit: 'kg' | 'lb' = 'kg';
}
