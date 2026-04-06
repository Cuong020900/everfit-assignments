import type { HistoryResult } from '@src/model/repositories/workout-entry/workout-entry.repository.types';
import { WorkoutEntryService } from '@src/modules/workout-entry/workout-entry.service';
import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import { createWorkoutEntryRepoMock } from '../repositories/workout-repository.mock';

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const makeHistoryResult = (overrides: Partial<HistoryResult> = {}): HistoryResult => ({
  entries: [
    {
      id: 'entry-1',
      date: '2024-01-15',
      exerciseName: 'Bench Press',
      sets: [{ reps: 5, weightKg: 100, unit: WeightUnit.KG }],
    },
  ],
  nextCursor: null,
  ...overrides,
});

describe('WorkoutEntryService.getHistory()', () => {
  let service: WorkoutEntryService;
  let repo: ReturnType<typeof createWorkoutEntryRepoMock>;

  beforeEach(() => {
    repo = createWorkoutEntryRepoMock();
    service = Object.create(WorkoutEntryService.prototype);
    (service as any).repo = repo;
  });

  it('returns data in kg by default', async () => {
    repo.findHistory.mockResolvedValue(makeHistoryResult());

    const result = await service.getHistory({ userId: USER_ID, limit: 20, unit: WeightUnit.KG });

    expect(result.data[0].sets[0]).toMatchObject({ weight: 100, unit: WeightUnit.KG });
  });

  it('converts weightKg to lb when unit=lb requested', async () => {
    repo.findHistory.mockResolvedValue(makeHistoryResult());

    const result = await service.getHistory({ userId: USER_ID, limit: 20, unit: WeightUnit.LB });

    expect(result.data[0].sets[0].weight).toBeCloseTo(220.46, 1);
    expect(result.data[0].sets[0].unit).toBe('lb');
  });

  it('returns nextCursor null and hasMore false when no more pages', async () => {
    repo.findHistory.mockResolvedValue(makeHistoryResult({ nextCursor: null }));

    const result = await service.getHistory({ userId: USER_ID, limit: 20, unit: WeightUnit.KG });

    expect(result.pagination.nextCursor).toBeNull();
    expect(result.pagination.hasMore).toBe(false);
  });

  it('returns nextCursor and hasMore true when more pages exist', async () => {
    repo.findHistory.mockResolvedValue(makeHistoryResult({ nextCursor: 'abc123' }));

    const result = await service.getHistory({ userId: USER_ID, limit: 20, unit: WeightUnit.KG });

    expect(result.pagination.nextCursor).toBe('abc123');
    expect(result.pagination.hasMore).toBe(true);
  });

  it('returns limit in pagination', async () => {
    repo.findHistory.mockResolvedValue(makeHistoryResult());

    const result = await service.getHistory({ userId: USER_ID, limit: 10, unit: WeightUnit.KG });

    expect(result.pagination.limit).toBe(10);
  });

  it('passes all filters through to repository', async () => {
    repo.findHistory.mockResolvedValue(makeHistoryResult());

    await service.getHistory({
      userId: USER_ID,
      limit: 10,
      cursor: 'cursor-xyz',
      exerciseName: 'bench',
      from: '2024-01-01',
      to: '2024-01-31',
      muscleGroup: 'chest',
      unit: WeightUnit.KG,
    });

    expect(repo.findHistory).toHaveBeenCalledWith({
      userId: USER_ID,
      limit: 10,
      cursor: 'cursor-xyz',
      exerciseName: 'bench',
      from: '2024-01-01',
      to: '2024-01-31',
      muscleGroup: 'chest',
    });
  });

  it('returns empty data with null cursor when no entries', async () => {
    repo.findHistory.mockResolvedValue({ entries: [], nextCursor: null });

    const result = await service.getHistory({ userId: USER_ID, limit: 20, unit: WeightUnit.KG });

    expect(result.data).toHaveLength(0);
    expect(result.pagination.nextCursor).toBeNull();
    expect(result.pagination.hasMore).toBe(false);
  });
});
