import { Controller, Delete, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { InvitesService, type InviteView } from './invites.service'

@Controller('students/:id/invite')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  /** Создаёт ссылку-приглашение. Прошлые неиспользованные гасятся. */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) studentId: string,
  ): Promise<InviteView> {
    return this.invites.create(user.tutorId, studentId)
  }

  /** Отзывает приглашение: выданная ссылка перестаёт работать. */
  @Delete()
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) studentId: string,
  ): Promise<{ revoked: number }> {
    return this.invites.revoke(user.tutorId, studentId)
  }
}
