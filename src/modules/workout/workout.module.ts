import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExerciseMetadata } from '@src/modules/workout/entities/exercise-metadata.entity';
import { WorkoutEntry } from '@src/modules/workout/entities/workout-entry.entity';
import { WorkoutSet } from '@src/modules/workout/entities/workout-set.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorkoutEntry, WorkoutSet, ExerciseMetadata])],
})
export class WorkoutModule {}
