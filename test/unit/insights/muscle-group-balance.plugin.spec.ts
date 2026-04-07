import type { WorkoutData } from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';
import { MuscleGroupBalancePlugin } from '@src/modules/exercise-metadata/plugins/muscle-group-balance.plugin';

const makeData = (entries: WorkoutData['entries']): WorkoutData => ({
  userId: 'user-1',
  entries,
});

describe('MuscleGroupBalancePlugin', () => {
  const plugin = new MuscleGroupBalancePlugin();

  it('returns empty distribution and no warnings for no data', () => {
    expect(plugin.compute(makeData({} as any))).toEqual({ distribution: {}, warnings: [] });
    expect(plugin.compute(makeData([]))).toEqual({ distribution: {}, warnings: [] });
  });

  it('groups volume by muscle group as percentages in distribution', () => {
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

    expect(result.distribution.chest).toBeCloseTo(50, 1);
    expect(result.distribution.legs).toBeCloseTo(50, 1);
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

    expect(result.distribution.unknown).toBe(100);
  });

  it('returns empty distribution when all sets have zero volume', () => {
    const result = plugin.compute(
      makeData([
        {
          date: '2024-01-01',
          exerciseName: 'Bench',
          muscleGroup: 'chest',
          sets: [{ reps: 0, weightKg: 0 }],
        },
        {
          date: '2024-01-01',
          exerciseName: 'Squat',
          muscleGroup: 'legs',
          sets: [{ reps: 10, weightKg: 0 }],
        },
      ]),
    );
    expect(result.distribution).toEqual({});
    expect(result.warnings).toEqual([]);
  });

  it('percentages in distribution sum to 100', () => {
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

    const total = Object.values(result.distribution).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it('adds warning when a muscle group is below 20% of total', () => {
    // chest 10%, back 90% → chest gets warning
    const result = plugin.compute(
      makeData([
        {
          date: '2024-01-01',
          exerciseName: 'Bench',
          muscleGroup: 'chest',
          sets: [{ reps: 1, weightKg: 10 }], // 10
        },
        {
          date: '2024-01-01',
          exerciseName: 'Row',
          muscleGroup: 'back',
          sets: [{ reps: 1, weightKg: 90 }], // 90
        },
      ]),
    );

    expect(result.warnings).toContain('chest volume is lower than recommended');
    expect(result.warnings).not.toContain('back volume is lower than recommended');
  });

  it('no warnings when all groups are at or above 20%', () => {
    const result = plugin.compute(
      makeData([
        {
          date: '2024-01-01',
          exerciseName: 'Bench',
          muscleGroup: 'chest',
          sets: [{ reps: 10, weightKg: 50 }], // 500
        },
        {
          date: '2024-01-01',
          exerciseName: 'Row',
          muscleGroup: 'back',
          sets: [{ reps: 10, weightKg: 50 }], // 500
        },
      ]),
    );

    expect(result.warnings).toHaveLength(0);
  });

  it('has the correct plugin name', () => {
    expect(plugin.name).toBe('muscleGroupBalance');
  });
});
