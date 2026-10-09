import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import { PrismaService } from '../../prisma/prisma.service'
import type { AuthUser, JwtPayload } from '../auth.types'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

/**
 * Глобальный guard: всё закрыто, пока явно не помечено @Public.
 *
 * Выбор в пользу «закрыто по умолчанию» осознанный: забыть повесить
 * защиту на новый роут легко, а последствия — чужие данные наружу.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>()
    const token = this.extractToken(request)
    if (!token) throw new UnauthorizedException('Требуется авторизация')

    let payload: JwtPayload
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token)
    } catch {
      // Причину (истёк / подделан / битый) клиенту не сообщаем.
      throw new UnauthorizedException('Недействительный токен')
    }

    if (typeof payload.sub !== 'string' || typeof payload.tid !== 'string') {
      throw new UnauthorizedException('Недействительный токен')
    }

    // Токен живёт дни, а бан должен действовать сразу: смотрим в базу на каждый запрос
    // (по первичному ключу — дёшево).
    const tutor = await this.prisma.tutor.findUnique({ where: { id: payload.tid }, select: { bannedAt: true } })
    if (tutor?.bannedAt) throw new ForbiddenException('Доступ к кабинету закрыт')

    request.user = { userId: payload.sub, tutorId: payload.tid }
    return true
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization
    if (!header) return null
    const [scheme, value] = header.split(' ')
    if (scheme !== 'Bearer' || !value) return null
    return value
  }
}
