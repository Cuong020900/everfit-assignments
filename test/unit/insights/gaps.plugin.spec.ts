import { GapsPlugin } from '@src/modules/exercise-metadata/plugins/gaps.plugin';
import type { WorkoutData } from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';

const makeData = (entries: WorkoutData['entries'], to?: string): WorkoutData => ({
  userId: 'user-1',
  to,
  entries,
});

describe('GapsPlugin', () => {
  const plugin = new GapsPlugin();

  it('returns empty array for no data', () => {
    expect(plugin.compute(makeData([]))).toEqual([]);
  });

  it('flags exercise not done in 2+ weeks that was previously regular', () => {
    const to = '2024-02-15';
    const result = plugin.compute(
      makeData(
        [
          // Regular in Jan (3 sessions in 28-day window before last date)
          { date: '2024-01-01', exerciseName: 'Bench', muscleGroup: 'chest', sets: [] },
          { date: '2024-01-08', exerciseName: 'Bench', muscleGroup: 'chest', sets: [] },
          { date: '2024-01-15', exerciseName: 'Bench', muscleGroup: 'chest', sets: [] },
          // Last done Jan 15 — more than 14 days before Feb 15
        ],
        to,
      ),
    );

    expect(result).toHaveLength(1);
    expect(result[0].exerciseName).toBe('Bench');
    expect(result[0].lastPerformed).toBe('2024-01-15');
    expect(result[0].daysSince).toBe(31);
  });

  it('does not flag exercise done within 14 days of to date', () => {
    const to = '2024-02-15';
    const result = plugin.compute(
      makeData(
        [
          { date: '2024-01-15', exerciseName: 'Bench', muscleGroup: 'chest', sets: [] },
          { date: '2024-02-10', exerciseName: 'Bench', muscleGroup: 'chest', sets: [] }, // 5 days before to
        ],
        to,
      ),
    );

    expect(result).toHaveLength(0);
  });

  it('does not flag exercise done only once (not regular)', () => {
    const to = '2024-02-15';
    const result = plugin.compute(
      makeData([{ date: '2024-01-01', exerciseName: 'Bench', muscleGroup: 'chest', sets: [] }], to),
    );

    expect(result).toHaveLength(0);
  });

  it('uses today as to date when not provided (empty entries)', () => {
    const result = plugin.compute(makeData([]));
    expect(Array.isArray(result)).toBe(true);
  });

  it('uses today as to date when not provided (with entries)', () => {
    // Entries that are old enough to be flagged regardless of today's date
    const longAgo = '2020-01-01';
    const result = plugin.compute(
      makeData([
        { date: longAgo, exerciseName: 'OldLift', muscleGroup: 'back', sets: [] },
        { date: '2020-01-08', exerciseName: 'OldLift', muscleGroup: 'back', sets: [] },
      ]),
    );
    // No to provided — uses today. Last session was years ago, will always be flagged.
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('uses explicit to date when provided with actual entries', () => {
    const to = '2024-03-01';
    const result = plugin.compute(
      makeData(
        [
          { date: '2024-01-01', exerciseName: 'Deadlift', muscleGroup: 'back', sets: [] },
          { date: '2024-01-08', exerciseName: 'Deadlift', muscleGroup: 'back', sets: [] },
        ],
        to,
      ),
    );
    // 2 sessions, last on 2024-01-08, 52 days before to — should be flagged
    expect(result).toHaveLength(1);
    expect(result[0].exerciseName).toBe('Deadlift');
    expect(result[0].daysSince).toBeGreaterThan(14);
  });

  it('deduplicates entries with the same date for an exercise', () => {
    const to = '2024-02-15';
    // Two entries for same exercise on same date (duplicate date)
    const result = plugin.compute(
      makeData(
        [
          { date: '2024-01-01', exerciseName: 'Squat', muscleGroup: 'legs', sets: [] },
          { date: '2024-01-01', exerciseName: 'Squat', muscleGroup: 'legs', sets: [] }, // duplicate
          { date: '2024-01-08', exerciseName: 'Squat', muscleGroup: 'legs', sets: [] },
        ],
        to,
      ),
    );
    // After dedup, 2 unique dates: Jan 1 and Jan 8 — both in 28-day window → regular
    // Last date Jan 8, 38 days before Feb 15 → flagged
    expect(result).toHaveLength(1);
    expect(result[0].exerciseName).toBe('Squat');
    expect(result[0].lastPerformed).toBe('2024-01-08');
  });
});
