import type { WorkoutData } from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';
import { MuscleGroupBalancePlugin } from '@src/modules/exercise-metadata/plugins/muscle-group-balance.plugin';

const makeData = (entries: WorkoutData['entries']): WorkoutData => ({
  userId: 'user-1',
  entries,
});

describe('MuscleGroupBalancePlugin', () => {
  const plugin = new MuscleGroupBalancePlugin();

  it('returns empty object for no data', () => {
    expect(plugin.compute(makeData({} as any))).toEqual({});
    expect(plugin.compute(makeData([]))).toEqual({});
  });

  it('groups volume by muscle group as percentages', () => {
    const result = plugin.compute(
      makeData([
        {
          date: '2024-01-01',
          exerciseName: 'Bench',
          muscleGroup: 'chest',
          sets: [{ reps: 10, weightKg: 100 }],
        }, // 1000
        {
          date: '2024-01-01',
          exerciseName: 'Squat',
          muscleGroup: 'legs',
          sets: [{ reps: 10, weightKg: 100 }],
        }, // 1000
      ]),
    );

    expect(result.chest).toBeCloseTo(50, 1);
    expect(result.legs).toBeCloseTo(50, 1);
  });

  it('puts null muscleGroup exercises into "unknown" bucket', () => {
    const result = plugin.compute(
      makeData([
        {
          date: '2024-01-01',
          exerciseName: 'Mystery',
          muscleGroup: null,
          sets: [{ reps: 10, weightKg: 100 }],
        },
      ]),
    );

    expect(result.unknown).toBe(100);
  });

  it('percentages sum to 100', () => {
    const result = plugin.compute(
      makeData([
        {
          date: '2024-01-01',
          exerciseName: 'Bench',
          muscleGroup: 'chest',
          sets: [{ reps: 5, weightKg: 80 }],
        },
        {
          date: '2024-01-01',
          exerciseName: 'Squat',
          muscleGroup: 'legs',
          sets: [{ reps: 3, weightKg: 120 }],
        },
        {
          date: '2024-01-01',
          exerciseName: 'Mystery',
          muscleGroup: null,
          sets: [{ reps: 10, weightKg: 50 }],
        },
      ]),
    );

    const total = Object.values(result as Record<string, number>).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(100, 1);
  });
});
