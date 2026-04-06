import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import Modules from '@src/modules';
import { RequestIdMiddleware } from '@src/shared/middleware/request-id.middleware';

@Module({
  imports: [...Modules],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
