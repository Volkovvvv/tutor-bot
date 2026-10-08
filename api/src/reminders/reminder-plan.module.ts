import { Module } from '@nestjs/common'
import { ReminderPlanner } from './reminder-planner.service'

// Без BotModule: планировать должны и те, от кого зависит сам бот
@Module({
  providers: [ReminderPlanner],
  exports: [ReminderPlanner],
})
export class ReminderPlanModule {}
