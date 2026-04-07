import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ description: 'User UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD, default: 30 days ago)', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD, default: today)', example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
