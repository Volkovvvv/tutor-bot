import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'
import { PrismaService } from '../prisma/prisma.service'

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Проверка живости для хостинга. Дёргает базу, а не просто
   * возвращает 200: инстанс без работающей БД считается больным.
   */
  @Public()
  @Get()
  async check(): Promise<{ status: string; db: string }> {
    await this.prisma.$queryRaw`SELECT 1`
    return { status: 'ok', db: 'ok' }
  }
}
