import { Module } from '@nestjs/common'
import { StudentsController } from './students.controller'
import { StudentsService } from './students.service'
import { TutorsModule } from '../tutors/tutors.module'

@Module({
  imports: [TutorsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
