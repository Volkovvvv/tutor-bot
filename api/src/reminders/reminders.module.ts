import { Module } from '@nestjs/common'
import { BotModule } from '../bot/bot.module'
import { RemindersScheduler } from './reminders.scheduler'
import { RemindersService } from './reminders.service'

@Module({
  imports: [BotModule],
  providers: [RemindersService, RemindersScheduler],
  // LessonsModule планирует напоминания при создании занятий.
  exports: [RemindersService],
})
export class RemindersModule {}
