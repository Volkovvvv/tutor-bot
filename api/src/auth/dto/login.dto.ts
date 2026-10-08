import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class LoginDto {
  /**
   * Строка window.Telegram.WebApp.initData целиком, как её отдал Telegram.
   * Разбирать её на клиенте и присылать поля по отдельности нельзя —
   * подпись считается по исходной строке.
   */
  @IsString()
  @IsNotEmpty({ message: 'initData обязателен' })
  @MaxLength(8192)
  initData!: string

  /**
   * Таймзона устройства («Asia/Yekaterinburg»): в ней репетитор ставит
   * занятия, в ней же показываем время в напоминаниях и считаем тихие часы.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string
}
