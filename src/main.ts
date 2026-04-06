import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '@src/app.module';
import { EEnvKey } from '@src/shared/constants/env-keys.enum';
import { GlobalExceptionFilter } from '@src/shared/filters/http-exception.filter';
import { TransformResponseInterceptor } from '@src/shared/interceptors/transform-response.interceptor';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  app.use(helmet());

  const config = app.get(ConfigService);

  const corsOrigins = config.get<string>(EEnvKey.CORS_ORIGINS);
  app.enableCors({
    origin: corsOrigins != null ? corsOrigins.split(',') : '*',
    methods: ['GET', 'POST'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Workout Tracking API')
    .setDescription('Track workout history, personal records, and training insights')
    .setVersion('1.0')
    .addServer('http://localhost:3000', 'Local')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>(EEnvKey.PORT, 3000);
  await app.listen(port);
}

bootstrap();
