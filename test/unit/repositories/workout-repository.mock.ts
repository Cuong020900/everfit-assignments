import type { IExerciseMetadataRepository } from '@src/model/repositories/exercise-metadata/exercise-metadata.repository.interface';
import type { IWorkoutEntryRepository } from '@src/model/repositories/workout-entry/workout-entry.repository.interface';
import type { IWorkoutSetRepository } from '@src/model/repositories/workout-set/workout-set.repository.interface';

export const createWorkoutEntryRepoMock = (): jest.Mocked<IWorkoutEntryRepository> => ({
  saveEntries: jest.fn(),
  findHistory: jest.fn(),
});

export const createWorkoutSetRepoMock = (): jest.Mocked<IWorkoutSetRepository> => ({
  findPRSets: jest.fn(),
  findProgressSeries: jest.fn(),
});

export const createExerciseMetadataRepoMock = (): jest.Mocked<IExerciseMetadataRepository> => ({
  findWorkoutData: jest.fn(),
});
