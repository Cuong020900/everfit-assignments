import { ExerciseMetadataService } from '@src/modules/exercise-metadata/exercise-metadata.service';
import { createExerciseMetadataRepoMock } from '../repositories/workout-repository.mock';

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const makePlugin = (key: string, returnValue: unknown) => ({
  key,
  compute: jest.fn().mockReturnValue(returnValue),
});

describe('ExerciseMetadataService.getInsights()', () => {
  let service: ExerciseMetadataService;
  let repo: ReturnType<typeof createExerciseMetadataRepoMock>;

  beforeEach(() => {
    repo = createExerciseMetadataRepoMock();
    service = Object.create(ExerciseMetadataService.prototype);
    (service as any).repo = repo;
  });

  it('runs all plugins and returns keyed results', async () => {
    repo.findWorkoutData.mockResolvedValue([]);
    const pluginA = makePlugin('mostTrained', []);
    const pluginB = makePlugin('trainingFrequency', { sessionsPerWeek: 0, totalSessions: 0 });
    (service as any).plugins = [pluginA, pluginB];

    const result = await service.getInsights({ userId: USER_ID });

    expect(result.data.mostTrained).toEqual([]);
    expect(result.data.trainingFrequency).toEqual({ sessionsPerWeek: 0, totalSessions: 0 });
  });

  it('passes WorkoutData (with entries) to every plugin', async () => {
    const entries = [{ date: '2024-01-01', exerciseName: 'Bench', muscleGroup: 'chest', sets: [] }];
    repo.findWorkoutData.mockResolvedValue(entries);
    const plugin = makePlugin('mostTrained', []);
    (service as any).plugins = [plugin];

    await service.getInsights({ userId: USER_ID, from: '2024-01-01', to: '2024-01-31' });

    expect(plugin.compute).toHaveBeenCalledWith({
      userId: USER_ID,
      from: '2024-01-01',
      to: '2024-01-31',
      entries,
    });
  });

  it('calls repo with userId/from/to', async () => {
    repo.findWorkoutData.mockResolvedValue([]);
    (service as any).plugins = [];

    await service.getInsights({ userId: USER_ID, from: '2024-01-01', to: '2024-01-31' });

    expect(repo.findWorkoutData).toHaveBeenCalledWith({
      userId: USER_ID,
      from: '2024-01-01',
      to: '2024-01-31',
    });
  });
});
