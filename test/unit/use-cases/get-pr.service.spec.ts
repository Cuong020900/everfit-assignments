import type { PRSetResult } from '@src/model/repositories/workout-set/workout-set.repository.types';
import { WorkoutSetService } from '@src/modules/workout-set/workout-set.service';
import { CompareTo } from '@src/shared/enums/compare-to.enum';
import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import { createWorkoutSetRepoMock } from '../repositories/workout-repository.mock';

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function findExercise<T extends { exerciseName: string }>(data: T[], name: string): T {
  const found = data.find((e) => e.exerciseName === name);
  if (!found) throw new Error(`Exercise "${name}" not found in data`);
  return found;
}

const makeSet = (overrides: Partial<PRSetResult>): PRSetResult => ({
  reps: 5,
  weightKg: 100,
  date: '2024-01-15',
  exerciseName: 'Bench Press',
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

  it('returns empty data array when no sets', async () => {
    repo.findPRSets.mockResolvedValue([]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.KG });

    expect(result.data).toEqual([]);
  });

  it('groups results by exerciseName', async () => {
    repo.findPRSets.mockResolvedValue([
      makeSet({ exerciseName: 'Bench Press', weightKg: 100 }),
      makeSet({ exerciseName: 'Squat', weightKg: 120 }),
    ]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.KG });

    expect(result.data).toHaveLength(2);
    const names = result.data.map((e) => e.exerciseName);
    expect(names).toContain('Bench Press');
    expect(names).toContain('Squat');
  });

  it('returns null PRs when exercise has no sets (empty group)', async () => {
    repo.findPRSets.mockResolvedValue([makeSet({ exerciseName: 'Bench Press' })]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.KG });

    const bench = findExercise(result.data, 'Bench Press');
    expect(bench.prs.maxWeight).not.toBeNull();
    expect(bench.prs.maxVolume).not.toBeNull();
    expect(bench.prs.bestOneRM).not.toBeNull();
  });

  it('returns heaviest set as maxWeight', async () => {
    repo.findPRSets.mockResolvedValue([
      makeSet({ weightKg: 100, date: '2024-01-10' }),
      makeSet({ weightKg: 120, date: '2024-01-15' }),
      makeSet({ weightKg: 80, date: '2024-01-05' }),
    ]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.KG });

    const bench = findExercise(result.data, 'Bench Press');
    expect(bench.prs.maxWeight?.value).toBe(120);
    expect(bench.prs.maxWeight?.achievedAt).toBe('2024-01-15');
  });

  it('returns highest volume set as maxVolume (reps × weightKg)', async () => {
    repo.findPRSets.mockResolvedValue([
      makeSet({ reps: 5, weightKg: 100 }), // volume = 500
      makeSet({ reps: 10, weightKg: 80 }), // volume = 800 ← winner
      makeSet({ reps: 3, weightKg: 120 }), // volume = 360
    ]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.KG });

    const bench = findExercise(result.data, 'Bench Press');
    expect(bench.prs.maxVolume?.reps).toBe(10);
  });

  it('returns best estimated 1RM using Epley formula as bestOneRM', async () => {
    repo.findPRSets.mockResolvedValue([
      makeSet({ reps: 5, weightKg: 100, date: '2024-01-10' }), // 1RM ≈ 116.67
      makeSet({ reps: 1, weightKg: 110, date: '2024-01-15' }), // 1RM ≈ 113.67
    ]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.KG });

    const bench = findExercise(result.data, 'Bench Press');
    expect(bench.prs.bestOneRM?.value).toBeCloseTo(116.67, 1);
    expect(bench.prs.bestOneRM?.achievedAt).toBe('2024-01-10');
  });

  it('converts PR weights to lb when unit=lb', async () => {
    repo.findPRSets.mockResolvedValue([makeSet({ weightKg: 100 })]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.LB });

    const bench = findExercise(result.data, 'Bench Press');
    expect(bench.prs.maxWeight?.value).toBeCloseTo(220.46, 1);
    expect(bench.prs.maxWeight?.unit).toBe('lb');
  });

  it('each PR value includes achievedAt date', async () => {
    repo.findPRSets.mockResolvedValue([makeSet({ date: '2024-03-20' })]);

    const result = await service.getPRs({ userId: USER_ID, unit: WeightUnit.KG });

    const bench = findExercise(result.data, 'Bench Press');
    expect(bench.prs.maxWeight?.achievedAt).toBe('2024-03-20');
    expect(bench.prs.maxVolume?.achievedAt).toBe('2024-03-20');
    expect(bench.prs.bestOneRM?.achievedAt).toBe('2024-03-20');
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

  it('includes comparison when compareTo=previousPeriod', async () => {
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

    const bench = findExercise(result.data, 'Bench Press');
    expect(bench.comparison).toBeDefined();
    expect(bench.comparison?.maxWeight?.current).toBe(120);
    expect(bench.comparison?.maxWeight?.previous).toBe(100);
    expect(bench.comparison?.maxWeight?.deltaKg).toBe(20);
  });

  it('comparison deltaKg and deltaPct computed correctly', async () => {
    repo.findPRSets
      .mockResolvedValueOnce([makeSet({ weightKg: 110 })])
      .mockResolvedValueOnce([makeSet({ weightKg: 100 })]);

    const result = await service.getPRs({
      userId: USER_ID,
      from: '2024-02-01',
      to: '2024-02-29',
      compareTo: CompareTo.PREVIOUS_PERIOD,
      unit: WeightUnit.KG,
    });

    const bench = findExercise(result.data, 'Bench Press');
    expect(bench.comparison?.maxWeight?.deltaKg).toBe(10);
    expect(bench.comparison?.maxWeight?.deltaPct).toBeCloseTo(10, 1);
  });

  it('comparison includes maxVolume and bestOneRM deltas', async () => {
    repo.findPRSets
      .mockResolvedValueOnce([makeSet({ reps: 10, weightKg: 100 })]) // current: vol=1000, 1RM≈133.3
      .mockResolvedValueOnce([makeSet({ reps: 5, weightKg: 80 })]); // prev: vol=400, 1RM≈93.3

    const result = await service.getPRs({
      userId: USER_ID,
      from: '2024-02-01',
      to: '2024-02-29',
      compareTo: CompareTo.PREVIOUS_PERIOD,
      unit: WeightUnit.KG,
    });

    const bench = findExercise(result.data, 'Bench Press');
    expect(bench.comparison?.maxVolume).toBeDefined();
    expect(bench.comparison?.maxVolume?.current).toBe(1000);
    expect(bench.comparison?.maxVolume?.previous).toBe(400);
    expect(bench.comparison?.maxVolume?.deltaKg).toBe(600);

    expect(bench.comparison?.bestOneRM).toBeDefined();
    expect(bench.comparison?.bestOneRM?.current).toBeGreaterThan(0);
    expect(bench.comparison?.bestOneRM?.previous).toBeGreaterThan(0);
  });

  it('exercise only in previous period returns null current PRs with comparison', async () => {
    // current period: Squat only; previous period: Bench Press only
    repo.findPRSets
      .mockResolvedValueOnce([makeSet({ exerciseName: 'Squat', weightKg: 120 })])
      .mockResolvedValueOnce([makeSet({ exerciseName: 'Bench Press', weightKg: 100 })]);

    const result = await service.getPRs({
      userId: USER_ID,
      from: '2024-02-01',
      to: '2024-02-29',
      compareTo: CompareTo.PREVIOUS_PERIOD,
      unit: WeightUnit.KG,
    });

    // Bench Press only in prev → current sets = [] → prs all null
    const bench = findExercise(result.data, 'Bench Press');
    expect(bench).toBeDefined();
    expect(bench.prs.maxWeight).toBeNull();
    expect(bench.prs.maxVolume).toBeNull();
    expect(bench.prs.bestOneRM).toBeNull();
    // comparison should still exist with prev values, current = 0
    expect(bench.comparison).toBeDefined();
    expect(bench.comparison?.maxWeight?.current).toBe(0);
    expect(bench.comparison?.maxWeight?.previous).toBe(100);

    // Squat only in current → prev sets = [] → prevPrs all null
    const squat = findExercise(result.data, 'Squat');
    expect(squat).toBeDefined();
    expect(squat.prs.maxWeight?.value).toBe(120);
    expect(squat.comparison).toBeDefined();
    expect(squat.comparison?.maxWeight?.current).toBe(120);
    expect(squat.comparison?.maxWeight?.previous).toBe(0);
  });

  it('buildDelta returns deltaPct=0 when previous is 0', async () => {
    // exercise only in current period → prev maxWeight is null → previous=0
    repo.findPRSets
      .mockResolvedValueOnce([makeSet({ exerciseName: 'Deadlift', weightKg: 150 })])
      .mockResolvedValueOnce([]); // previous period empty

    const result = await service.getPRs({
      userId: USER_ID,
      from: '2024-02-01',
      to: '2024-02-29',
      compareTo: CompareTo.PREVIOUS_PERIOD,
      unit: WeightUnit.KG,
    });

    const dl = findExercise(result.data, 'Deadlift');
    expect(dl.comparison?.maxWeight?.previous).toBe(0);
    expect(dl.comparison?.maxWeight?.deltaPct).toBe(0);
    expect(dl.comparison?.maxWeight?.deltaKg).toBe(150);
  });

  it('both PRs null for a metric omits that comparison field', async () => {
    // Both current and prev are empty → all PR values null → no comparison fields
    repo.findPRSets
      .mockResolvedValueOnce([]) // current empty
      .mockResolvedValueOnce([]); // prev empty

    const result = await service.getPRs({
      userId: USER_ID,
      from: '2024-02-01',
      to: '2024-02-29',
      compareTo: CompareTo.PREVIOUS_PERIOD,
      unit: WeightUnit.KG,
    });

    // No exercises at all → empty data
    expect(result.data).toHaveLength(0);
  });

  it('comparison period dates are calculated correctly (mirror of main period length)', async () => {
    repo.findPRSets
      .mockResolvedValueOnce([makeSet({ weightKg: 100 })])
      .mockResolvedValueOnce([makeSet({ weightKg: 80 })]);

    const result = await service.getPRs({
      userId: USER_ID,
      from: '2024-02-01',
      to: '2024-02-29',
      compareTo: CompareTo.PREVIOUS_PERIOD,
      unit: WeightUnit.KG,
    });

    const bench = findExercise(result.data, 'Bench Press');
    expect(bench.comparison?.period.from).toBe('2024-02-01');
    expect(bench.comparison?.period.to).toBe('2024-02-29');
    // prev period should mirror length before the main period
    expect(bench.comparison?.prevPeriod).toBeDefined();
  });
});
