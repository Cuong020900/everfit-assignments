import type { WorkoutData } from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';
import { MostTrainedPlugin } from '@src/modules/exercise-metadata/plugins/most-trained.plugin';

const makeData = (entries: WorkoutData['entries']): WorkoutData => ({
  userId: 'user-1',
  entries,
});

describe('MostTrainedPlugin', () => {
  const plugin = new MostTrainedPlugin();

  it('returns empty array for no data', () => {
    expect(plugin.compute(makeData([]))).toEqual([]);
  });

  it('counts sessions per exercise (unique dates)', () => {
    const result = plugin.compute(
      makeData([
        {
          date: '2024-01-01',
          exerciseName: 'Bench Press',
          muscleGroup: 'chest',
          sets: [{ reps: 5, weightKg: 100 }],
        },
        {
          date: '2024-01-02',
          exerciseName: 'Bench Press',
          muscleGroup: 'chest',
          sets: [{ reps: 5, weightKg: 100 }],
        },
        {
          date: '2024-01-01',
          exerciseName: 'Squat',
          muscleGroup: 'legs',
          sets: [{ reps: 5, weightKg: 120 }],
        },
      ]),
    );

    const bench = result.find((r: any) => r.exerciseName === 'Bench Press');
    expect(bench.sessions).toBe(2);
    const squat = result.find((r: any) => r.exerciseName === 'Squat');
    expect(squat.sessions).toBe(1);
  });

  it('computes total volume per exercise (sum of reps × weightKg)', () => {
    const result = plugin.compute(
      makeData([
        {
          date: '2024-01-01',
          exerciseName: 'Bench Press',
          muscleGroup: 'chest',
          sets: [
            { reps: 5, weightKg: 100 },
            { reps: 3, weightKg: 110 },
          ],
        },
      ]),
    );

    expect(result[0].volume).toBe(5 * 100 + 3 * 110); // 830
  });

  it('sorts by session count descending', () => {
    const result = plugin.compute(
      makeData([
        {
          date: '2024-01-01',
          exerciseName: 'Squat',
          muscleGroup: 'legs',
          sets: [{ reps: 5, weightKg: 100 }],
        },
        {
          date: '2024-01-01',
          exerciseName: 'Bench',
          muscleGroup: 'chest',
          sets: [{ reps: 5, weightKg: 80 }],
        },
        {
          date: '2024-01-02',
          exerciseName: 'Bench',
          muscleGroup: 'chest',
          sets: [{ reps: 5, weightKg: 80 }],
        },
      ]),
    );

    expect(result[0].exerciseName).toBe('Bench');
  });
});
