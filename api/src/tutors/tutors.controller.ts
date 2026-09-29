import { Body, Controller, Get, Patch } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { UpdateTutorDto } from './dto/update-tutor.dto'
import { TutorsService, type TutorView } from './tutors.service'

/** Профиль своего кабинета. Кабинет берётся из токена — чужой не запросить. */
@Controller('tutor')
export class TutorsController {
  constructor(private readonly tutors: TutorsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<TutorView> {
    return this.tutors.get(user.tutorId)
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateTutorDto): Promise<TutorView> {
    return this.tutors.update(user.tutorId, dto)
  }
}
