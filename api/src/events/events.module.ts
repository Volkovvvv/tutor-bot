import { Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'
import { StatsService } from './stats.service'

// Ни от чего, кроме базы, не зависит: на него опираются и материалы,
// и бот, а бот сам нужен материалам — обратная зависимость дала бы цикл.
@Module({
  controllers: [EventsController],
  providers: [EventsService, StatsService],
  exports: [EventsService, StatsService],
})
export class EventsModule {}
