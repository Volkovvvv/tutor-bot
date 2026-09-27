import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  app.setGlobalPrefix('api')

  app.useGlobalPipes(
    new ValidationPipe({
      // Отрезает поля, которых нет в DTO: клиент не должен уметь
      // дописывать в запрос лишние ключи.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // Мини-апп открывается с другого домена, поэтому CORS обязателен.
  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
  })

  const port = config.get<number>('PORT') ?? 3000
  await app.listen(port)

  Logger.log(`API слушает http://localhost:${port}/api`, 'Bootstrap')
}

void bootstrap()
