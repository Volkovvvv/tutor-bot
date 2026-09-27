import { Module } from '@nestjs/common'
import { InvitesModule } from '../invites/invites.module'
import { BotController } from './bot.controller'
import { BotService } from './bot.service'

@Module({
  imports: [InvitesModule],
  controllers: [BotController],
  providers: [BotService],
  // Планировщик на следующем этапе будет отправлять через BotService.
  exports: [BotService],
})
export class BotModule {}
