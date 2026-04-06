import { Controller, Get, NotImplementedException, Query } from '@nestjs/common';
import { GetPRDTO } from '@src/modules/workout-set/dto/get-pr.dto';
import { GetProgressDTO } from '@src/modules/workout-set/dto/get-progress.dto';

@Controller('workouts')
export class WorkoutSetController {
  @Get('pr')
  async getPRs(@Query() _dto: GetPRDTO): Promise<void> {
    throw new NotImplementedException();
  }

  @Get('progress')
  async getProgress(@Query() _dto: GetProgressDTO): Promise<void> {
    throw new NotImplementedException();
  }
}
