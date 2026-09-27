import { Module } from '@nestjs/common'
import { RemindersModule } from '../reminders/reminders.module'
import { LessonsController } from './lessons.controller'
import { LessonsService } from './lessons.service'

@Module({
  imports: [RemindersModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
