import type {
  HistoryQuery,
  HistoryResult,
  WorkoutEntryInput,
} from '@src/model/repositories/workout-entry/workout-entry.repository.types';

export const WORKOUT_ENTRY_REPOSITORY = 'WORKOUT_ENTRY_REPOSITORY';

export interface IWorkoutEntryRepository {
  saveEntries(userId: string, date: string, entries: WorkoutEntryInput[]): Promise<void>;
  findHistory(query: HistoryQuery): Promise<HistoryResult>;
}
