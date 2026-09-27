import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

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
}
