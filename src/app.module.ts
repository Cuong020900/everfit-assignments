import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from '@src/config/configuration';
import * as Joi from 'joi';
import type { Params as PinoParams } from 'nestjs-pino';
import { LoggerModule } from 'nestjs-pino';

const NODE_ENV_VALUES = ['development', 'production', 'test'] as const;
type NodeEnv = (typeof NODE_ENV_VALUES)[number];

function resolveNodeEnv(): NodeEnv {
  const env = process.env.NODE_ENV;
  if (env === 'production' || env === 'test') return env;
  return 'development';
}

function resolveDbPort(): number {
  const raw = process.env.DB_PORT;
  if (raw !== undefined && raw !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid(...NODE_ENV_VALUES)
          .default('development'),
        DB_HOST: Joi.string().optional(),
        DB_PORT: Joi.number().optional(),
        DB_NAME: Joi.string().optional(),
        DB_USER: Joi.string().optional(),
        DB_PASSWORD: Joi.string().optional(),
      }),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const dbPortFromEnv = resolveDbPort();
        return {
          type: 'postgres',
          host: process.env.DB_HOST ?? config.getOrThrow<string>('database.host'),
          port: dbPortFromEnv !== 0 ? dbPortFromEnv : config.getOrThrow<number>('database.port'),
          database: process.env.DB_NAME ?? config.getOrThrow<string>('database.name'),
          username: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          synchronize: false,
          logging: config.get<boolean>('database.logging') ?? false,
          entities: [`${__dirname}/modules/**/*.entity{.ts,.js}`],
          migrations: [`${__dirname}/database/migrations/*{.ts,.js}`],
          migrationsRun: true,
        };
      },
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): PinoParams => {
        const level = config.get<string>('logging.level') ?? 'info';
        const isDev = resolveNodeEnv() === 'development';
        return {
          pinoHttp: {
            level,
            transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
            redact: ['req.headers.authorization'],
          },
        };
      },
    }),
  ],
})
export class AppModule {}
