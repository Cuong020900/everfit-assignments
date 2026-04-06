import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigurationModule } from '@src/config/config.module';
import { DatabaseCommonModule } from '@src/model/database-common';
import { ExerciseMetadataModule } from '@src/modules/exercise-metadata/exercise-metadata.module';
import { WorkoutEntryModule } from '@src/modules/workout-entry/workout-entry.module';
import { WorkoutSetModule } from '@src/modules/workout-set/workout-set.module';
import { EEnvKey } from '@src/shared/constants/env-keys.enum';
import type { Params as PinoParams } from 'nestjs-pino';
import { LoggerModule } from 'nestjs-pino';

const Modules = [
  ConfigurationModule,
  TypeOrmModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
      type: 'postgres',
      host: config.get<string>(EEnvKey.DB_HOST),
      port: config.get<number>(EEnvKey.DB_PORT),
      database: config.get<string>(EEnvKey.DB_NAME),
      username: config.get<string>(EEnvKey.DB_USER),
      password: config.get<string>(EEnvKey.DB_PASSWORD),
      synchronize: false,
      logging: config.get<string>(EEnvKey.NODE_ENV) === 'development',
      entities: [`${__dirname}/model/entities/*.entity{.ts,.js}`],
      migrations: [`${__dirname}/database/migrations/*{.ts,.js}`],
      migrationsRun: true,
    }),
  }),
  LoggerModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService): PinoParams => {
      const level = config.get<string>(EEnvKey.LOG_LEVEL) ?? 'info';
      const isDev = config.get<string>(EEnvKey.NODE_ENV) === 'development';
      return {
        pinoHttp: {
          level,
          transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
          redact: ['req.headers.authorization'],
          customSuccessMessage: () => 'request completed',
          customLogLevel: (_req, res) => {
            if (res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'debug';
          },
          customProps: (req) => ({ requestId: req.id }),
        },
      };
    },
  }),
  WorkoutEntryModule,
  WorkoutSetModule,
  ExerciseMetadataModule,
  DatabaseCommonModule,
];

export default Modules;
