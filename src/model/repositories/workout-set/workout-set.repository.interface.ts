import type {
  PRQuery,
  PRSetResult,
  ProgressQuery,
  ProgressSetResult,
} from '@src/model/repositories/workout-set/workout-set.repository.types';

export const WORKOUT_SET_REPOSITORY = 'WORKOUT_SET_REPOSITORY';

export interface IWorkoutSetRepository {
  findPRSets(query: PRQuery): Promise<PRSetResult[]>;
  findProgressSeries(query: ProgressQuery): Promise<ProgressSetResult[]>;
}
