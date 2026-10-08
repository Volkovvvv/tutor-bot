import { Module } from '@nestjs/common'
import { BotModule } from '../bot/bot.module'
import { EventsModule } from '../events/events.module'
import { AiService } from './ai.service'
import { MaterialsController } from './materials.controller'
import { MaterialsService } from './materials.service'

@Module({
  imports: [BotModule, EventsModule],
  controllers: [MaterialsController],
  providers: [MaterialsService, AiService],
  // ИИ нужен и импорту расписания
  exports: [AiService],
})
export class MaterialsModule {}
