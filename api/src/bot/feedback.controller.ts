import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { AuthUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { FeedbackDto } from '../events/dto/track-event.dto'
import { EventsService } from '../events/events.service'
import { PrismaService } from '../prisma/prisma.service'
import { BotService } from './bot.service'

/** «Написать разработчику»: сообщение сохраняется и сразу уходит администратору в Telegram. */
@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly bot: BotService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @Post()
  @HttpCode(204)
  async send(@CurrentUser() user: AuthUser, @Body() dto: FeedbackDto): Promise<void> {
    await this.events.saveFeedback(user.tutorId, dto.text, dto.screen)

    const tutor = await this.prisma.tutor.findUnique({
      where: { id: user.tutorId },
      select: { user: { select: { firstName: true, lastName: true, username: true } } },
    })
    const name = [tutor?.user.firstName, tutor?.user.lastName].filter(Boolean).join(' ')
    const handle = tutor?.user.username ? ` (@${tutor.user.username})` : ''
    // Сбой отправки не мешает: текст уже в базе
    await this.bot.notifyAdmin(
      `💬 ${name}${handle}${dto.screen ? ` · экран: ${dto.screen}` : ''}\n\n${dto.text.trim()}`,
    )
  }
}
