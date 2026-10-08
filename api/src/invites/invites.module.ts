import { Module } from '@nestjs/common'
import { ReminderPlanModule } from '../reminders/reminder-plan.module'
import { InvitesController } from './invites.controller'
import { InvitesService } from './invites.service'

@Module({
  imports: [ReminderPlanModule],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
