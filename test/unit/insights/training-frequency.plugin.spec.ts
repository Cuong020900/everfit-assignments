import type { WorkoutData } from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';
import { TrainingFrequencyPlugin } from '@src/modules/exercise-metadata/plugins/training-frequency.plugin';

const makeData = (entries: WorkoutData['entries'], from?: string, to?: string): WorkoutData => ({
  userId: 'user-1',
  from,
  to,
  entries,
});

describe('TrainingFrequencyPlugin', () => {
  const plugin = new TrainingFrequencyPlugin();

  it('returns 0 sessions and 0 weeksAnalyzed for no data', () => {
    const result = plugin.compute(makeData([]));
    expect(result.totalSessions).toBe(0);
    expect(result.sessionsPerWeek).toBe(0);
    expect(result.weeksAnalyzed).toBe(0);
  });

  it('counts unique session dates as total sessions', () => {
    const result = plugin.compute(
      makeData([
        { date: '2024-01-01', exerciseName: 'Bench', muscleGroup: null, sets: [] },
        { date: '2024-01-01', exerciseName: 'Squat', muscleGroup: null, sets: [] }, // same date = 1 session
        { date: '2024-01-03', exerciseName: 'Bench', muscleGroup: null, sets: [] },
      ]),
    );

    expect(result.totalSessions).toBe(2);
  });

  it('computes sessions per week from date range', () => {
    // 2 sessions over exactly 2 weeks = 1 session/week
    const result = plugin.compute(
      makeData(
        [
          { date: '2024-01-01', exerciseName: 'Bench', muscleGroup: null, sets: [] },
          { date: '2024-01-08', exerciseName: 'Bench', muscleGroup: null, sets: [] },
        ],
        '2024-01-01',
        '2024-01-14',
      ),
    );

    expect(result.sessionsPerWeek).toBeCloseTo(1, 1);
  });

  it('includes weeksAnalyzed rounded to 1 decimal', () => {
    const result = plugin.compute(
      makeData(
        [
          { date: '2024-01-01', exerciseName: 'Bench', muscleGroup: null, sets: [] },
          { date: '2024-01-08', exerciseName: 'Bench', muscleGroup: null, sets: [] },
        ],
        '2024-01-01',
        '2024-01-14',
      ),
    );

    // 14 days = 2 weeks
    expect(result.weeksAnalyzed).toBeCloseTo(2, 0);
  });

  it('uses entry date range when from/to not provided', () => {
    const result = plugin.compute(
      makeData([
        { date: '2024-01-01', exerciseName: 'Bench', muscleGroup: null, sets: [] },
        { date: '2024-01-08', exerciseName: 'Bench', muscleGroup: null, sets: [] },
        { date: '2024-01-15', exerciseName: 'Bench', muscleGroup: null, sets: [] },
      ]),
    );

    expect(result.totalSessions).toBe(3);
    expect(result.sessionsPerWeek).toBeGreaterThan(0);
    expect(result.weeksAnalyzed).toBeGreaterThan(0);
  });

  it('has the correct plugin name', () => {
    expect(plugin.name).toBe('trainingFrequency');
  });
});
