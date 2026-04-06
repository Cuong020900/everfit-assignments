import { type ClassProvider, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExerciseMetadata } from '@src/model/entities/exercise-metadata.entity';
import { WorkoutEntry } from '@src/model/entities/workout-entry.entity';
import { WorkoutSet } from '@src/model/entities/workout-set.entity';
import { EXERCISE_METADATA_REPOSITORY } from '@src/model/repositories/exercise-metadata/exercise-metadata.repository.interface';
import { ExerciseMetadataController } from '@src/modules/exercise-metadata/exercise-metadata.controller';
import { ExerciseMetadataService } from '@src/modules/exercise-metadata/exercise-metadata.service';
import { GapsPlugin } from '@src/modules/exercise-metadata/plugins/gaps.plugin';
import { INSIGHT_PLUGINS } from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';
import { MostTrainedPlugin } from '@src/modules/exercise-metadata/plugins/most-trained.plugin';
import { MuscleGroupBalancePlugin } from '@src/modules/exercise-metadata/plugins/muscle-group-balance.plugin';
import { TrainingFrequencyPlugin } from '@src/modules/exercise-metadata/plugins/training-frequency.plugin';
import { TypeOrmExerciseMetadataRepository } from '@src/modules/exercise-metadata/repositories/typeorm-exercise-metadata.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ExerciseMetadata, WorkoutEntry, WorkoutSet])],
  controllers: [ExerciseMetadataController],
  providers: [
    ExerciseMetadataService,
    { provide: EXERCISE_METADATA_REPOSITORY, useClass: TypeOrmExerciseMetadataRepository },
    { provide: INSIGHT_PLUGINS, useClass: MostTrainedPlugin, multi: true } as ClassProvider,
    { provide: INSIGHT_PLUGINS, useClass: TrainingFrequencyPlugin, multi: true } as ClassProvider,
    { provide: INSIGHT_PLUGINS, useClass: MuscleGroupBalancePlugin, multi: true } as ClassProvider,
    { provide: INSIGHT_PLUGINS, useClass: GapsPlugin, multi: true } as ClassProvider,
  ],
})
export class ExerciseMetadataModule {}
