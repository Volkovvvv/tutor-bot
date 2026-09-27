import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { AuthService, type LoginResult } from './auth.service'
import type { AuthUser } from './auth.types'
import { CurrentUser } from './decorators/current-user.decorator'
import { Public } from './decorators/public.decorator'
import { LoginDto } from './dto/login.dto'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Вход в мини-апп. Единственный открытый роут: пока токена нет,
   * получить его больше негде.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(dto.initData)
  }

  /** Проверка токена — нужна фронту, чтобы понять, жива ли сессия. */
  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user
  }
}
