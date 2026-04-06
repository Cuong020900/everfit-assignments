import { Inject, Injectable } from '@nestjs/common';
import {
  EXERCISE_METADATA_REPOSITORY,
  type IExerciseMetadataRepository,
} from '@src/model/repositories/exercise-metadata/exercise-metadata.repository.interface';
import type { GetInsightsDTO, GetInsightsResult } from '@src/modules/exercise-metadata/dto/get-insights.dto';
import { INSIGHT_PLUGINS, type InsightPlugin } from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';

@Injectable()
export class ExerciseMetadataService {
  constructor(
    @Inject(EXERCISE_METADATA_REPOSITORY)
    private readonly repo: IExerciseMetadataRepository,
    @Inject(INSIGHT_PLUGINS)
    private readonly plugins: InsightPlugin[],
  ) {}

  async getInsights(dto: GetInsightsDTO): Promise<GetInsightsResult> {
    const entries = await this.repo.findWorkoutData({
      userId: dto.userId,
      from: dto.from,
      to: dto.to,
    });

    const workoutData = { userId: dto.userId, from: dto.from, to: dto.to, entries };

    // biome-ignore lint/suspicious/noExplicitAny: dynamic plugin keys build a typed InsightsData object
    const data: any = {};
    for (const plugin of this.plugins) {
      data[plugin.key] = plugin.compute(workoutData);
    }

    return { data };
  }
}
