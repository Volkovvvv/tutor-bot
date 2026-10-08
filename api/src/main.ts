import { Logger, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { json, type NextFunction, type Request, type Response } from 'express'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  const config = app.get(ConfigService)

  // За прокси хостинга req.ip — адрес прокси. TRUST_PROXY — сколько прокси
  // стоит перед приложением (обычно 1); без него заголовку X-Forwarded-For
  // не верим: напрямую его может подставить кто угодно.
  const trustProxy = Number(config.get('TRUST_PROXY') ?? 0)
  if (trustProxy > 0) app.set('trust proxy', trustProxy)

  app.setGlobalPrefix('api')

  // Фото расписания не влезает в обычные 100 КБ тела запроса. Лимит поднят
  // только этому роуту: большое тело на любом другом — не наш клиент.
  // Стоит до парсера Nest — тот уже разобранное тело не трогает.
  // Обёртка обязательна: Nest ищет в стеке middleware с именем jsonParser
  // и, найдя, не подключает свой — тела остальных запросов остались бы пустыми.
  const photoBody = json({ limit: '5mb' })
  app.use('/api/lessons/import/recognize', (req: Request, res: Response, next: NextFunction) =>
    photoBody(req, res, next),
  )

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
