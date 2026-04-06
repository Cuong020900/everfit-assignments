import type { ApiResult } from '@src/shared/types/api-response.type';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export interface MostTrainedEntry {
  exerciseName: string;
  sessions: number;
  volume: number; // sum of reps × weightKg
}

export interface TrainingFrequencyData {
  sessionsPerWeek: number;
  totalSessions: number;
}

export interface MuscleGroupBalanceData {
  [muscleGroup: string]: number; // % share of total volume
}

export interface GapEntry {
  exerciseName: string;
  lastPerformed: string;
  daysSince: number;
}

export interface InsightsData {
  mostTrained: MostTrainedEntry[];
  trainingFrequency: TrainingFrequencyData;
  muscleGroupBalance: MuscleGroupBalanceData;
  gaps: GapEntry[];
}

export interface GetInsightsResult extends ApiResult<InsightsData> {}

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
