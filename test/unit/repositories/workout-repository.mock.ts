import type { IWorkoutRepository } from '@src/modules/workout/interfaces/workout.repository.interface';

export const createMockRepository = (): jest.Mocked<IWorkoutRepository> => ({
  saveEntries: jest.fn(),
  findHistory: jest.fn(),
  findPRs: jest.fn(),
  findProgressSeries: jest.fn(),
  findWorkoutData: jest.fn(),
});
