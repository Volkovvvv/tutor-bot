import { Module } from '@nestjs/common'
import { EventsModule } from '../events/events.module'
import { MaterialsModule } from '../materials/materials.module'
import { ReminderPlanModule } from '../reminders/reminder-plan.module'
import { LessonSeriesService } from './lesson-series.service'
import { LessonsController } from './lessons.controller'
import { LessonsService } from './lessons.service'
import { ScheduleImportService } from './schedule-import.service'

@Module({
  imports: [ReminderPlanModule, MaterialsModule, EventsModule],
  controllers: [LessonsController],
  providers: [LessonsService, ScheduleImportService, LessonSeriesService],
  exports: [LessonsService],
})
export class LessonsModule {}
