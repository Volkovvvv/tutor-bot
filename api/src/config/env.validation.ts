import { plainToInstance } from 'class-transformer'
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, validateSync } from 'class-validator'

export enum BotMode {
  polling = 'polling',
  webhook = 'webhook',
}

export enum NodeEnv {
  development = 'development',
  production = 'production',
  test = 'test',
}

/**
 * Схема переменных окружения.
 *
 * Проверяется на старте: приложение, которому не хватает BOT_TOKEN,
 * должно падать сразу с понятным текстом, а не через час на первом
 * запросе к Telegram.
 */
class EnvVars {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string

  // Тем же токеном проверяется HMAC-подпись initData,
  // поэтому он обязателен даже без запущенного бота.
  @IsString()
  @IsNotEmpty()
  BOT_TOKEN!: string

  @IsString()
  @IsOptional()
  BOT_USERNAME?: string

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string

  @IsNumber()
  @IsOptional()
  PORT?: number

  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV?: NodeEnv

  @IsEnum(BotMode, { message: 'BOT_MODE: polling | webhook' })
  @IsOptional()
  BOT_MODE?: BotMode

  @IsString()
  @IsOptional()
  BOT_PUBLIC_URL?: string

  @IsString()
  @IsOptional()
  BOT_WEBHOOK_SECRET?: string
}

export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const parsed = plainToInstance(EnvVars, raw, { enableImplicitConversion: true })
  const errors = validateSync(parsed, { skipMissingProperties: false })

  if (errors.length > 0) {
    const details = errors
      .map((e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n')
    throw new Error(`Некорректные переменные окружения:\n${details}\n\nСм. .env.example`)
  }

  // Webhook без секрета — открытый эндпоинт, принимающий «обновления»
  // от любого желающего. Проверяем на старте, а не в рантайме.
  if (parsed.BOT_MODE === BotMode.webhook) {
    if (!parsed.BOT_PUBLIC_URL) {
      throw new Error('BOT_MODE=webhook требует BOT_PUBLIC_URL')
    }
    if (!parsed.BOT_WEBHOOK_SECRET || parsed.BOT_WEBHOOK_SECRET.length < 16) {
      throw new Error(
        'BOT_MODE=webhook требует BOT_WEBHOOK_SECRET длиной не меньше 16 символов ' +
          '(openssl rand -hex 32)',
      )
    }
  }

  return parsed
}
