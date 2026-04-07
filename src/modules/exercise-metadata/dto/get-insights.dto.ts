import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export interface InsightItem {
  name: string;
  // biome-ignore lint/suspicious/noExplicitAny: plugin data varies by type
  data: any;
}

export interface GetInsightsResult {
  period: { from: string; to: string };
  insights: InsightItem[];
}

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
