import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

// Глобальный: PrismaService нужен почти каждому модулю,
// импортировать его в каждый по отдельности — лишний шум.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
