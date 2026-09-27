import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { AuthUser } from '../auth.types'

/** Достаёт пользователя, положенного в request гвардом. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>()
    if (!request.user) {
      // Сюда можно попасть только если роут помечен @Public,
      // но всё равно просит пользователя — это ошибка программиста.
      throw new Error('CurrentUser использован на роуте без авторизации')
    }
    return request.user
  },
)
