import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { AuthUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { TrackEventDto } from './dto/track-event.dto'
import { EventsService } from './events.service'

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** События, которых не видит сервер: оценка материала, заявка на «больше». */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post()
  @HttpCode(204)
  async track(@CurrentUser() user: AuthUser, @Body() dto: TrackEventDto): Promise<void> {
    await this.events.trackClient(user.tutorId, dto.name, dto.props)
  }
}
