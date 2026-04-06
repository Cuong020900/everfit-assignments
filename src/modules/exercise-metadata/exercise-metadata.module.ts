import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExerciseMetadata } from '@src/model/entities/exercise-metadata.entity';
import { ExerciseMetadataController } from '@src/modules/exercise-metadata/exercise-metadata.controller';
import { ExerciseMetadataService } from '@src/modules/exercise-metadata/exercise-metadata.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExerciseMetadata])],
  controllers: [ExerciseMetadataController],
  providers: [ExerciseMetadataService],
})
export class ExerciseMetadataModule {}
