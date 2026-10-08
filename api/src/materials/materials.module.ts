import { Module } from '@nestjs/common'
import { BotModule } from '../bot/bot.module'
import { AiService } from './ai.service'
import { MaterialsController } from './materials.controller'
import { MaterialsService } from './materials.service'

@Module({
  imports: [BotModule],
  controllers: [MaterialsController],
  providers: [MaterialsService, AiService],
  // ИИ нужен и импорту расписания
  exports: [AiService],
})
export class MaterialsModule {}
