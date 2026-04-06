import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExerciseMetadata } from '@src/model/entities/exercise-metadata.entity';
import { WorkoutEntry } from '@src/model/entities/workout-entry.entity';
import { WorkoutSet } from '@src/model/entities/workout-set.entity';
import { EXERCISE_METADATA_REPOSITORY } from '@src/model/repositories/exercise-metadata/exercise-metadata.repository.interface';
import { ExerciseMetadataController } from '@src/modules/exercise-metadata/exercise-metadata.controller';
import { ExerciseMetadataService } from '@src/modules/exercise-metadata/exercise-metadata.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExerciseMetadata, WorkoutEntry, WorkoutSet])],
  controllers: [ExerciseMetadataController],
  providers: [
    ExerciseMetadataService,
    { provide: EXERCISE_METADATA_REPOSITORY, useValue: null },
  ],
})
export class ExerciseMetadataModule {}
