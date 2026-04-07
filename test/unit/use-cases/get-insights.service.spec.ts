import { ExerciseMetadataService } from '@src/modules/exercise-metadata/exercise-metadata.service';
import { createExerciseMetadataRepoMock } from '../repositories/workout-repository.mock';

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const makePlugin = (name: string, returnValue: unknown) => ({
  name,
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

  it('returns empty insights array when no entries', async () => {
    repo.findWorkoutData.mockResolvedValue([]);
    (service as any).plugins = [makePlugin('mostTrained', [])];

    const result = await service.getInsights({ userId: USER_ID });

    expect(result.insights).toEqual([]);
    expect(result.period).toBeDefined();
  });

  it('returns { period, insights } envelope', async () => {
    repo.findWorkoutData.mockResolvedValue([
      { date: '2024-01-01', exerciseName: 'Bench', muscleGroup: 'chest', sets: [] },
    ]);
    const pluginA = makePlugin('mostTrained', { byFrequency: [], byVolume: [] });
    (service as any).plugins = [pluginA];

    const result = await service.getInsights({
      userId: USER_ID,
      from: '2024-01-01',
      to: '2024-01-31',
    });

    expect(result.period).toEqual({ from: '2024-01-01', to: '2024-01-31' });
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].name).toBe('mostTrained');
    expect(result.insights[0].data).toEqual({ byFrequency: [], byVolume: [] });
  });

  it('runs all plugins and collects results', async () => {
    repo.findWorkoutData.mockResolvedValue([
      { date: '2024-01-01', exerciseName: 'Bench', muscleGroup: 'chest', sets: [] },
    ]);
    const pluginA = makePlugin('mostTrained', { byFrequency: [], byVolume: [] });
    const pluginB = makePlugin('trainingFrequency', {
      sessionsPerWeek: 0,
      totalSessions: 0,
      weeksAnalyzed: 0,
    });
    (service as any).plugins = [pluginA, pluginB];

    const result = await service.getInsights({ userId: USER_ID });

    expect(result.insights).toHaveLength(2);
    expect(result.insights[0].name).toBe('mostTrained');
    expect(result.insights[1].name).toBe('trainingFrequency');
  });

  it('passes WorkoutData (with entries) to every plugin', async () => {
    const entries = [{ date: '2024-01-01', exerciseName: 'Bench', muscleGroup: 'chest', sets: [] }];
    repo.findWorkoutData.mockResolvedValue(entries);
    const plugin = makePlugin('mostTrained', { byFrequency: [], byVolume: [] });
    (service as any).plugins = [plugin];

    await service.getInsights({ userId: USER_ID, from: '2024-01-01', to: '2024-01-31' });

    expect(plugin.compute).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        entries,
      }),
    );
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

  it('skips plugins that return null or undefined', async () => {
    repo.findWorkoutData.mockResolvedValue([
      { date: '2024-01-01', exerciseName: 'Bench', muscleGroup: 'chest', sets: [] },
    ]);
    const pluginNull = makePlugin('nullPlugin', null);
    const pluginUndefined = makePlugin('undefinedPlugin', undefined);
    const pluginValid = makePlugin('validPlugin', { value: 42 });
    (service as any).plugins = [pluginNull, pluginUndefined, pluginValid];

    const result = await service.getInsights({ userId: USER_ID });

    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].name).toBe('validPlugin');
  });

  it('period defaults to last 30 days when from/to not provided', async () => {
    repo.findWorkoutData.mockResolvedValue([]);
    (service as any).plugins = [];

    const result = await service.getInsights({ userId: USER_ID });

    expect(result.period.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.period.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
