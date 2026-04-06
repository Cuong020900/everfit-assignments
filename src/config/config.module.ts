import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EEnvKey } from '@src/shared/constants/env-keys.enum';
import * as Joi from 'joi';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        [EEnvKey.NODE_ENV]: Joi.string()
          .valid('development', 'production', 'test', 'staging')
          .default('development'),
        [EEnvKey.PORT]: Joi.number().default(3000),
        // database
        [EEnvKey.DB_HOST]: Joi.string().default('localhost'),
        [EEnvKey.DB_PORT]: Joi.number().default(5432),
        [EEnvKey.DB_NAME]: Joi.string().default('workout_db'),
        [EEnvKey.DB_USER]: Joi.string().default('workout'),
        [EEnvKey.DB_PASSWORD]: Joi.string().default('workout'),
        [EEnvKey.LOG_LEVEL]: Joi.string().default('info'),
        [EEnvKey.CORS_ORIGINS]: Joi.string().optional(),
      }),
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigurationModule {}
