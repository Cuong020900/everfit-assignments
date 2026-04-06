import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class GetInsightsDTO {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
