import type { PRSetResult } from '@src/model/repositories/workout-set/workout-set.repository.types';
import { WorkoutSetService } from '@src/modules/workout-set/workout-set.service';
import { CompareTo } from '@src/shared/enums/compare-to.enum';
import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import { createWorkoutSetRepoMock } from '../repositories/workout-repository.mock';

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const makeSet = (overrides: Partial<PRSetResult>): PRSetResult => ({
  reps: 5,
  weightKg: 100,
  date: '2024-01-15',
  ...overrides,
});

describe('WorkoutSetService.getPRs()', () => {
  let service: WorkoutSetService;
  let repo: ReturnType<typeof createWorkoutSetRepoMock>;

  beforeEach(() => {
    repo = createWorkoutSetRepoMock();
    service = Object.create(WorkoutSetService.prototype);
    (service as any).repo = repo;
  });

  it('returns null PRs when no data', async () => {
    repo.findPRSets.mockResolvedValue([]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.KG });

    expect(result.data.maxWeight).toBeNull();
    expect(result.data.maxVolume).toBeNull();
    expect(result.data.best1RM).toBeNull();
  });

  it('returns heaviest set as maxWeight', async () => {
    repo.findPRSets.mockResolvedValue([
      makeSet({ weightKg: 100, date: '2024-01-10' }),
      makeSet({ weightKg: 120, date: '2024-01-15' }),
      makeSet({ weightKg: 80, date: '2024-01-05' }),
    ]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.KG });

    expect(result.data.maxWeight?.weight).toBe(120);
    expect(result.data.maxWeight?.date).toBe('2024-01-15');
  });

  it('returns highest volume set as maxVolume (reps × weightKg)', async () => {
    repo.findPRSets.mockResolvedValue([
      makeSet({ reps: 5, weightKg: 100 }), // volume = 500
      makeSet({ reps: 10, weightKg: 80 }), // volume = 800 ← winner
      makeSet({ reps: 3, weightKg: 120 }), // volume = 360
    ]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.KG });

    expect(result.data.maxVolume?.reps).toBe(10);
    expect(result.data.maxVolume?.weight).toBeCloseTo(80, 2);
  });

  it('returns best estimated 1RM using Epley formula', async () => {
    repo.findPRSets.mockResolvedValue([
      makeSet({ reps: 5, weightKg: 100, date: '2024-01-10' }), // 1RM ≈ 116.67
      makeSet({ reps: 1, weightKg: 110, date: '2024-01-15' }), // 1RM ≈ 113.67
    ]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.KG });

    expect(result.data.best1RM?.estimated1RM).toBeCloseTo(116.67, 1);
    expect(result.data.best1RM?.date).toBe('2024-01-10');
  });

  it('converts PR weights to lb when unit=lb', async () => {
    repo.findPRSets.mockResolvedValue([makeSet({ weightKg: 100 })]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.LB });

    expect(result.data.maxWeight?.weight).toBeCloseTo(220.46, 1);
    expect(result.data.maxWeight?.unit).toBe('lb');
  });

  it('each PR includes date', async () => {
    repo.findPRSets.mockResolvedValue([makeSet({ date: '2024-03-20' })]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.KG });

    expect(result.data.maxWeight?.date).toBe('2024-03-20');
    expect(result.data.maxVolume?.date).toBe('2024-03-20');
    expect(result.data.best1RM?.date).toBe('2024-03-20');
  });

  it('passes filters to repository', async () => {
    repo.findPRSets.mockResolvedValue([]);

    await service.getPRs({
      userId: USER_ID,
      exerciseName: 'Bench Press',
      from: '2024-01-01',
      to: '2024-01-31',
      unit: WeightUnit.KG,
    });

    expect(repo.findPRSets).toHaveBeenCalledWith({
      userId: USER_ID,
      exerciseName: 'Bench Press',
      from: '2024-01-01',
      to: '2024-01-31',
    });
  });

  it('includes previous period when compareTo=previousPeriod', async () => {
    repo.findPRSets
      .mockResolvedValueOnce([makeSet({ weightKg: 120 })]) // current
      .mockResolvedValueOnce([makeSet({ weightKg: 100 })]); // previous

    const result = await service.getPRs({
      userId: USER_ID,
      from: '2024-02-01',
      to: '2024-02-29',
      compareTo: CompareTo.PREVIOUS_PERIOD,
      unit: WeightUnit.KG,
    });

    expect(result.data.previous?.maxWeight?.weight).toBe(100);
  });

  it('previous is null PRs when no data in previous period', async () => {
    repo.findPRSets.mockResolvedValueOnce([makeSet({ weightKg: 120 })]).mockResolvedValueOnce([]);

    const result = await service.getPRs({
      userId: USER_ID,
      from: '2024-02-01',
      to: '2024-02-29',
      compareTo: CompareTo.PREVIOUS_PERIOD,
      unit: WeightUnit.KG,
    });

    expect(result.data.previous?.maxWeight).toBeNull();
  });
});
