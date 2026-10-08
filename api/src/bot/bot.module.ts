import { Module } from '@nestjs/common'
import { EventsModule } from '../events/events.module'
import { InvitesModule } from '../invites/invites.module'
import { BotController } from './bot.controller'
import { BotService } from './bot.service'
import { FeedbackController } from './feedback.controller'
import { SurveysService } from './surveys.service'

@Module({
  imports: [InvitesModule, EventsModule],
  controllers: [BotController, FeedbackController],
  providers: [BotService, SurveysService],
  // Планировщик на следующем этапе будет отправлять через BotService.
  exports: [BotService],
})
export class BotModule {}
