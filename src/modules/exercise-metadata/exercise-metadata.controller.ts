import { Controller, Get, NotImplementedException, Query } from '@nestjs/common';
import { GetInsightsDTO } from '@src/modules/exercise-metadata/dto/get-insights.dto';

@Controller('workouts')
export class ExerciseMetadataController {
  @Get('insights')
  async getInsights(@Query() _dto: GetInsightsDTO): Promise<void> {
    throw new NotImplementedException();
  }
}
