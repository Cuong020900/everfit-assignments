import type { WorkoutEntryData } from '@src/model/repositories/exercise-metadata/exercise-metadata.repository.types';

export interface WorkoutData {
  userId: string;
  from?: string;
  to?: string;
  entries: WorkoutEntryData[];
}

// biome-ignore lint/suspicious/noExplicitAny: plugin results vary per insight type
export type InsightResult = any;

export interface InsightPlugin {
  readonly name: string;
  compute(data: WorkoutData): InsightResult;
}

export const INSIGHT_PLUGINS = 'INSIGHT_PLUGINS';
