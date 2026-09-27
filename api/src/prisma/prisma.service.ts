import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

/**
 * Обёртка над PrismaClient, привязанная к жизненному циклу Nest.
 *
 * В Prisma 7 строка подключения больше не читается из схемы — клиент
 * получает её через адаптер драйвера, который мы и собираем здесь.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL')
    super({ adapter: new PrismaPg({ connectionString }) })
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
    this.logger.log('Подключение к базе установлено')
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
