import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import type { StringValue } from 'ms'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

/** Проверяет, что JWT_EXPIRES_IN похож на ms-строку вида "7d" / "30m". */
function parseExpiresIn(raw: string | undefined): StringValue {
  const value = (raw ?? '7d').trim()
  if (!/^\d+\s*(ms|s|m|h|d|w|y)$/i.test(value)) {
    throw new Error(`JWT_EXPIRES_IN должен быть вида "7d" или "30m", получено: "${value}"`)
  }
  return value as StringValue
}

// Глобальный: JwtAuthGuard подключён на уровне приложения,
// поэтому JwtService должен быть доступен вне этого модуля.
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // Формат ms-строки ("7d", "12h"). Опечатка здесь означала бы
          // токены с непредсказуемым сроком, поэтому проверяем явно.
          expiresIn: parseExpiresIn(config.get<string>('JWT_EXPIRES_IN')),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
