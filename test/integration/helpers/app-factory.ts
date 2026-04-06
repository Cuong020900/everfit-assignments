import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '@src/app.module';
import { GlobalExceptionFilter } from '@src/shared/filters/http-exception.filter';
import { TransformResponseInterceptor } from '@src/shared/interceptors/transform-response.interceptor';
import { DataSource } from 'typeorm';

export async function createTestApp(): Promise<{ app: INestApplication; dataSource: DataSource }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
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
  await app.init();

  const dataSource = moduleRef.get(DataSource);
  return { app, dataSource };
}
