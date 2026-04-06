import type { ProgressSetResult } from '@src/model/repositories/workout-set/workout-set.repository.types';
import { WorkoutSetService } from '@src/modules/workout-set/workout-set.service';
import { GroupBy } from '@src/shared/enums/group-by.enum';
import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import { createWorkoutSetRepoMock } from '../repositories/workout-repository.mock';

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const makeSet = (date: string, reps: number, weightKg: number): ProgressSetResult => ({
  date,
  reps,
  weightKg,
});

describe('WorkoutSetService.getProgress()', () => {
  let service: WorkoutSetService;
  let repo: ReturnType<typeof createWorkoutSetRepoMock>;

  beforeEach(() => {
    repo = createWorkoutSetRepoMock();
    service = Object.create(WorkoutSetService.prototype);
    (service as any).repo = repo;
  });

  it('returns empty series when no data', async () => {
    repo.findProgressSeries.mockResolvedValue([]);

    const result = await service.getProgress({
      userId: USER_ID,
      exerciseName: 'Bench Press',
      groupBy: GroupBy.DAILY,
      unit: WeightUnit.KG,
    });

    expect(result.data.series).toHaveLength(0);
    expect(result.data.note).toBeNull();
  });

  it('returns best weight per day (daily groupBy)', async () => {
    repo.findProgressSeries.mockResolvedValue([
      makeSet('2024-01-15', 5, 100),
      makeSet('2024-01-15', 3, 120), // best for this day
      makeSet('2024-01-16', 5, 110),
    ]);

    const result = await service.getProgress({
      userId: USER_ID,
      exerciseName: 'Bench Press',
      groupBy: GroupBy.DAILY,
      unit: WeightUnit.KG,
    });

    expect(result.data.series).toHaveLength(2);
    expect(result.data.series[0]).toMatchObject({ period: '2024-01-15', bestWeight: 120 });
    expect(result.data.series[1]).toMatchObject({ period: '2024-01-16', bestWeight: 110 });
  });

  it('includes volume per day (sum of reps × weightKg)', async () => {
    repo.findProgressSeries.mockResolvedValue([
      makeSet('2024-01-15', 5, 100), // 500
      makeSet('2024-01-15', 3, 100), // 300 → total 800
    ]);

    const result = await service.getProgress({
      userId: USER_ID,
      exerciseName: 'Bench Press',
      groupBy: GroupBy.DAILY,
      unit: WeightUnit.KG,
    });

    expect(result.data.series[0].volume).toBe(800);
  });

  it('groups into weeks (weekly groupBy)', async () => {
    repo.findProgressSeries.mockResolvedValue([
      makeSet('2024-01-15', 5, 100), // week 3
      makeSet('2024-01-16', 5, 110), // week 3
      makeSet('2024-01-22', 5, 115), // week 4
    ]);

    const result = await service.getProgress({
      userId: USER_ID,
      exerciseName: 'Bench Press',
      groupBy: GroupBy.WEEKLY,
      unit: WeightUnit.KG,
    });

    expect(result.data.series).toHaveLength(2);
    expect(result.data.series[0].period).toMatch(/2024-W/);
  });

  it('groups into months (monthly groupBy)', async () => {
    repo.findProgressSeries.mockResolvedValue([
      makeSet('2024-01-15', 5, 100),
      makeSet('2024-02-10', 5, 110),
    ]);

    const result = await service.getProgress({
      userId: USER_ID,
      exerciseName: 'Bench Press',
      groupBy: GroupBy.MONTHLY,
      unit: WeightUnit.KG,
    });

    expect(result.data.series).toHaveLength(2);
    expect(result.data.series[0].period).toBe('2024-01');
    expect(result.data.series[1].period).toBe('2024-02');
  });

  it('converts weights to requested unit', async () => {
    repo.findProgressSeries.mockResolvedValue([makeSet('2024-01-15', 5, 100)]);

    const result = await service.getProgress({
      userId: USER_ID,
      exerciseName: 'Bench Press',
      groupBy: GroupBy.DAILY,
      unit: WeightUnit.LB,
    });

    expect(result.data.series[0].bestWeight).toBeCloseTo(220.46, 1);
    expect(result.data.series[0].unit).toBe('lb');
  });

  it('sets note when only 1 data point', async () => {
    repo.findProgressSeries.mockResolvedValue([makeSet('2024-01-15', 5, 100)]);

    const result = await service.getProgress({
      userId: USER_ID,
      exerciseName: 'Bench Press',
      groupBy: GroupBy.DAILY,
      unit: WeightUnit.KG,
    });

    expect(result.data.note).not.toBeNull();
  });

  it('note is null when multiple data points', async () => {
    repo.findProgressSeries.mockResolvedValue([
      makeSet('2024-01-15', 5, 100),
      makeSet('2024-01-16', 5, 105),
    ]);

    const result = await service.getProgress({
      userId: USER_ID,
      exerciseName: 'Bench Press',
      groupBy: GroupBy.DAILY,
      unit: WeightUnit.KG,
    });

    expect(result.data.note).toBeNull();
  });

  it('passes filters to repository', async () => {
    repo.findProgressSeries.mockResolvedValue([]);

    await service.getProgress({
      userId: USER_ID,
      exerciseName: 'Squat',
      from: '2024-01-01',
      to: '2024-03-31',
      groupBy: GroupBy.DAILY,
      unit: WeightUnit.KG,
    });

    expect(repo.findProgressSeries).toHaveBeenCalledWith({
      userId: USER_ID,
      exerciseName: 'Squat',
      from: '2024-01-01',
      to: '2024-03-31',
    });
  });
});
