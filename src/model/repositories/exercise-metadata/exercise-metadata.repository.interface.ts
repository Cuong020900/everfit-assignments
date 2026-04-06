import type {
  InsightQuery,
  WorkoutEntryData,
} from '@src/model/repositories/exercise-metadata/exercise-metadata.repository.types';

export const EXERCISE_METADATA_REPOSITORY = 'EXERCISE_METADATA_REPOSITORY';

export interface IExerciseMetadataRepository {
  findWorkoutData(query: InsightQuery): Promise<WorkoutEntryData[]>;
}
