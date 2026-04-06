import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as Joi from 'joi';
import type { Params as PinoParams } from 'nestjs-pino';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        DB_HOST: Joi.string().default('localhost'),
        DB_PORT: Joi.number().default(5432),
        DB_NAME: Joi.string().default('workout_db'),
        DB_USER: Joi.string().default('workout'),
        DB_PASSWORD: Joi.string().default('workout'),
        PORT: Joi.number().default(3000),
        LOG_LEVEL: Joi.string().default('info'),
        CORS_ORIGINS: Joi.string().optional(),
      }),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        database: config.get<string>('DB_NAME'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        synchronize: false,
        logging: config.get<string>('NODE_ENV') === 'development',
        entities: [`${__dirname}/modules/**/*.entity{.ts,.js}`],
        migrations: [`${__dirname}/database/migrations/*{.ts,.js}`],
        migrationsRun: true,
      }),
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): PinoParams => {
        const level = config.get<string>('LOG_LEVEL') ?? 'info';
        const isDev = config.get<string>('NODE_ENV') === 'development';
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
