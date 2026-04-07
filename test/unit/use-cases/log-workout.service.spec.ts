import { WORKOUT_ENTRY_REPOSITORY } from '@src/model/repositories/workout-entry/workout-entry.repository.interface';
import type { SavedWorkoutEntry } from '@src/model/repositories/workout-entry/workout-entry.repository.types';
import { WorkoutEntryService } from '@src/modules/workout-entry/workout-entry.service';
import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import { createWorkoutEntryRepoMock } from '../repositories/workout-repository.mock';

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const makeSavedEntry = (exerciseName: string): SavedWorkoutEntry => ({
  id: 'entry-uuid-1',
  exerciseName,
  sets: [{ id: 'set-uuid-1', reps: 5, weight: 100, unit: WeightUnit.KG, weightKg: 100 }],
  createdAt: '2024-01-15T00:00:00.000Z',
});

describe('WorkoutEntryService.logWorkout()', () => {
  let service: WorkoutEntryService;
  let repo: ReturnType<typeof createWorkoutEntryRepoMock>;

  beforeEach(() => {
    repo = createWorkoutEntryRepoMock();
    service = new (WorkoutEntryService as any)({ [WORKOUT_ENTRY_REPOSITORY]: repo }, repo);
    // Use plain constructor injection pattern
    service = Object.create(WorkoutEntryService.prototype);
    (service as any).repo = repo;
  });

  it('calls saveEntries with weightKg computed from kg input', async () => {
    repo.saveEntries.mockResolvedValue([makeSavedEntry('Bench Press')]);

    await service.logWorkout(USER_ID, {
      date: '2024-01-15',
      entries: [
        { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: WeightUnit.KG }] },
      ],
    });

    expect(repo.saveEntries).toHaveBeenCalledWith(USER_ID, '2024-01-15', [
      {
        exerciseName: 'Bench Press',
        sets: [{ reps: 5, weight: 100, unit: WeightUnit.KG, weightKg: 100 }],
      },
    ]);
  });

  it('converts lb to kg at write time', async () => {
    repo.saveEntries.mockResolvedValue([makeSavedEntry('Squat')]);

    await service.logWorkout(USER_ID, {
      date: '2024-01-15',
      entries: [
        { exerciseName: 'Squat', sets: [{ reps: 3, weight: 220.46, unit: WeightUnit.LB }] },
      ],
    });

    const call = repo.saveEntries.mock.calls[0];
    const savedSet = call[2][0].sets[0];
    expect(savedSet.weightKg).toBeCloseTo(100, 1);
    expect(savedSet.weight).toBe(220.46);
    expect(savedSet.unit).toBe('lb');
  });

  it('handles bulk: multiple exercises in one request', async () => {
    repo.saveEntries.mockResolvedValue([makeSavedEntry('Bench Press'), makeSavedEntry('Squat')]);

    await service.logWorkout(USER_ID, {
      date: '2024-01-15',
      entries: [
        { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: WeightUnit.KG }] },
        { exerciseName: 'Squat', sets: [{ reps: 3, weight: 120, unit: WeightUnit.KG }] },
      ],
    });

    const savedEntries = repo.saveEntries.mock.calls[0][2];
    expect(savedEntries).toHaveLength(2);
    expect(savedEntries[0].exerciseName).toBe('Bench Press');
    expect(savedEntries[1].exerciseName).toBe('Squat');
  });

  it('passes userId and date through to repository', async () => {
    repo.saveEntries.mockResolvedValue([makeSavedEntry('Deadlift')]);

    await service.logWorkout(USER_ID, {
      date: '2024-03-20',
      entries: [
        { exerciseName: 'Deadlift', sets: [{ reps: 1, weight: 200, unit: WeightUnit.KG }] },
      ],
    });

    expect(repo.saveEntries).toHaveBeenCalledWith(USER_ID, '2024-03-20', expect.any(Array));
  });

  it('returns LogWorkoutResult with date, userId, and entries', async () => {
    const saved = [makeSavedEntry('Bench Press')];
    repo.saveEntries.mockResolvedValue(saved);

    const result = await service.logWorkout(USER_ID, {
      date: '2024-01-15',
      entries: [
        { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: WeightUnit.KG }] },
      ],
    });

    expect(result.date).toBe('2024-01-15');
    expect(result.userId).toBe(USER_ID);
    expect(result.entries).toEqual(saved);
  });

  it('throws INVALID_UNIT for unsupported unit', async () => {
    await expect(
      service.logWorkout(USER_ID, {
        date: '2024-01-15',
        entries: [
          {
            exerciseName: 'Bench Press',
            sets: [{ reps: 5, weight: 100, unit: 'stone' as any }],
          },
        ],
      }),
    ).rejects.toThrow('INVALID_UNIT');
  });
});
