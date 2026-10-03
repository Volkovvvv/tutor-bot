import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from './auth/auth.module'
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard'
import { BotModule } from './bot/bot.module'
import { validateEnv } from './config/env.validation'
import { HealthModule } from './health/health.module'
import { InvitesModule } from './invites/invites.module'
import { LessonsModule } from './lessons/lessons.module'
import { MaterialsModule } from './materials/materials.module'
import { PrismaModule } from './prisma/prisma.module'
import { RemindersModule } from './reminders/reminders.module'
import { StudentsModule } from './students/students.module'
import { TutorsModule } from './tutors/tutors.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Ограничение частоты: /auth/login — единственная открытая точка,
    // и подбор подписи должен стоить дорого.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    // Нужен для @Cron в планировщике напоминаний.
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TutorsModule,
    StudentsModule,
    LessonsModule,
    MaterialsModule,
    InvitesModule,
    BotModule,
    RemindersModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Глобально: любой новый роут закрыт, пока не помечен @Public.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
