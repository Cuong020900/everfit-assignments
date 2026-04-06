import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkoutModule } from '@src/modules/workout/workout.module';
import { EEnvKey } from '@src/shared/constants/env-keys.enum';
import { RequestIdMiddleware } from '@src/shared/middleware/request-id.middleware';
import * as Joi from 'joi';
import type { Params as PinoParams } from 'nestjs-pino';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        [EEnvKey.NODE_ENV]: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        [EEnvKey.DB_HOST]: Joi.string().default('localhost'),
        [EEnvKey.DB_PORT]: Joi.number().default(5432),
        [EEnvKey.DB_NAME]: Joi.string().default('workout_db'),
        [EEnvKey.DB_USER]: Joi.string().default('workout'),
        [EEnvKey.DB_PASSWORD]: Joi.string().default('workout'),
        [EEnvKey.PORT]: Joi.number().default(3000),
        [EEnvKey.LOG_LEVEL]: Joi.string().default('info'),
        [EEnvKey.CORS_ORIGINS]: Joi.string().optional(),
      }),
    }),

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
        entities: [`${__dirname}/modules/**/*.entity{.ts,.js}`],
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

    WorkoutModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
