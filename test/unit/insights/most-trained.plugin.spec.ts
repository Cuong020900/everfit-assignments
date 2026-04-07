import type { WorkoutData } from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';
import { MostTrainedPlugin } from '@src/modules/exercise-metadata/plugins/most-trained.plugin';

const makeData = (entries: WorkoutData['entries']): WorkoutData => ({
  userId: 'user-1',
  entries,
});

function findByExercise<T extends { exercise: string }>(arr: T[], name: string): T {
  const found = arr.find((r) => r.exercise === name);
  if (!found) throw new Error(`Exercise "${name}" not found`);
  return found;
}

describe('MostTrainedPlugin', () => {
  const plugin = new MostTrainedPlugin();

  it('returns { byFrequency: [], byVolume: [] } for no data', () => {
    const result = plugin.compute(makeData([]));
    expect(result.byFrequency).toEqual([]);
    expect(result.byVolume).toEqual([]);
  });

  it('counts sessions per exercise (unique dates) in byFrequency', () => {
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

    const bench = findByExercise(result.byFrequency, 'Bench Press');
    expect(bench.sessionCount).toBe(2);
    const squat = findByExercise(result.byFrequency, 'Squat');
    expect(squat.sessionCount).toBe(1);
  });

  it('computes total volume per exercise (sum of reps × weightKg) in byVolume', () => {
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

    const bench = findByExercise(result.byVolume, 'Bench Press');
    expect(bench.totalVolumeKg).toBe(5 * 100 + 3 * 110); // 830
  });

  it('byFrequency is sorted by session count descending', () => {
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

    expect(result.byFrequency[0].exercise).toBe('Bench');
    expect(result.byFrequency[0].sessionCount).toBe(2);
  });

  it('byVolume is sorted by total volume descending', () => {
    const result = plugin.compute(
      makeData([
        {
          date: '2024-01-01',
          exerciseName: 'Light',
          muscleGroup: 'chest',
          sets: [{ reps: 1, weightKg: 10 }], // 10
        },
        {
          date: '2024-01-01',
          exerciseName: 'Heavy',
          muscleGroup: 'back',
          sets: [{ reps: 5, weightKg: 200 }], // 1000
        },
      ]),
    );

    expect(result.byVolume[0].exercise).toBe('Heavy');
    expect(result.byVolume[0].totalVolumeKg).toBe(1000);
  });

  it('has the correct plugin name', () => {
    expect(plugin.name).toBe('mostTrained');
  });
});
