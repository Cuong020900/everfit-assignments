import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkoutEntry } from '@src/model/entities/workout-entry.entity';
import { WorkoutSet } from '@src/model/entities/workout-set.entity';
import { WORKOUT_SET_REPOSITORY } from '@src/model/repositories/workout-set/workout-set.repository.interface';
import { TypeOrmWorkoutSetRepository } from '@src/modules/workout-set/repositories/typeorm-workout-set.repository';
import { WorkoutSetController } from '@src/modules/workout-set/workout-set.controller';
import { WorkoutSetService } from '@src/modules/workout-set/workout-set.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkoutEntry, WorkoutSet])],
  controllers: [WorkoutSetController],
  providers: [
    WorkoutSetService,
    { provide: WORKOUT_SET_REPOSITORY, useClass: TypeOrmWorkoutSetRepository },
  ],
})
export class WorkoutSetModule {}
