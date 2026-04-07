import { Injectable } from '@nestjs/common';
import type {
  InsightPlugin,
  WorkoutData,
} from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';

interface MuscleGroupBalanceResult {
  distribution: Record<string, number>;
  warnings: string[];
}

@Injectable()
export class MuscleGroupBalancePlugin implements InsightPlugin {
  readonly name = 'muscleGroupBalance';

  compute(data: WorkoutData): MuscleGroupBalanceResult {
    if (!Array.isArray(data.entries) || data.entries.length === 0) {
      return { distribution: {}, warnings: [] };
    }

    const volumeByGroup = new Map<string, number>();

    for (const entry of data.entries) {
      const group = entry.muscleGroup ?? 'unknown';
      const entryVolume = entry.sets.reduce((s, set) => s + set.reps * set.weightKg, 0);
      volumeByGroup.set(group, (volumeByGroup.get(group) ?? 0) + entryVolume);
    }

    const total = Array.from(volumeByGroup.values()).reduce((s, v) => s + v, 0);
    if (total === 0) return { distribution: {}, warnings: [] };

    const distribution: Record<string, number> = {};
    for (const [group, volume] of volumeByGroup.entries()) {
      distribution[group] = Math.round((volume / total) * 1000) / 10;
    }

    const warnings: string[] = [];
    for (const [group, pct] of Object.entries(distribution)) {
      if (pct < 20) {
        warnings.push(`${group} volume is lower than recommended`);
      }
    }

    return { distribution, warnings };
  }
}
