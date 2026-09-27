// Prisma 7 берёт строку подключения отсюда (для CLI: migrate, studio).
// Рантайм-клиент получает её через адаптер — см. src/prisma/prisma.service.ts.
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
