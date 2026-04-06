import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotImplementedException,
  Post,
  Query,
} from '@nestjs/common';
import { GetHistoryDTO } from '@src/modules/workout-entry/dto/get-history.dto';
import { LogWorkoutDTO, LogWorkoutQueryDTO } from '@src/modules/workout-entry/dto/log-workout.dto';

@Controller('workouts')
export class WorkoutEntryController {
  @Post()
  @HttpCode(201)
  async logWorkout(
    @Query() _query: LogWorkoutQueryDTO,
    @Body() _dto: LogWorkoutDTO,
  ): Promise<void> {
    throw new NotImplementedException();
  }

  @Get()
  async getHistory(@Query() _dto: GetHistoryDTO): Promise<void> {
    throw new NotImplementedException();
  }
}
