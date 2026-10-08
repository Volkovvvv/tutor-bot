import { Module } from '@nestjs/common'
import { StudentsController } from './students.controller'
import { StudentsService } from './students.service'
import { ReminderPlanModule } from '../reminders/reminder-plan.module'
import { TutorsModule } from '../tutors/tutors.module'

@Module({
  imports: [TutorsModule, ReminderPlanModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
