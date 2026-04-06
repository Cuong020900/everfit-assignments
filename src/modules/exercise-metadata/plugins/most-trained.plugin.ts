import { Injectable } from '@nestjs/common';
import type { MostTrainedEntry } from '@src/modules/exercise-metadata/dto/get-insights.dto';
import type { InsightPlugin, WorkoutData } from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';

@Injectable()
export class MostTrainedPlugin implements InsightPlugin {
  readonly key = 'mostTrained';

  compute(data: WorkoutData): MostTrainedEntry[] {
    const map = new Map<string, { sessions: Set<string>; volume: number }>();

    for (const entry of data.entries) {
      const acc = map.get(entry.exerciseName) ?? { sessions: new Set(), volume: 0 };
      acc.sessions.add(entry.date);
      acc.volume += entry.sets.reduce((s, set) => s + set.reps * set.weightKg, 0);
      map.set(entry.exerciseName, acc);
    }

    return Array.from(map.entries())
      .map(([exerciseName, acc]) => ({
        exerciseName,
        sessions: acc.sessions.size,
        volume: acc.volume,
      }))
      .sort((a, b) => b.sessions - a.sessions);
  }
}
