import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from './auth/auth.module'
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard'
import { BotModule } from './bot/bot.module'
import { UserThrottlerGuard } from './common/user-throttler.guard'
import { validateEnv } from './config/env.validation'
import { EventsModule } from './events/events.module'
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
    EventsModule,
    InvitesModule,
    BotModule,
    RemindersModule,
    HealthModule,
  ],
  providers: [
    // Глобально: любой новый роут закрыт, пока не помечен @Public.
    // Первым: лимит запросов считается на репетитора, которого определяет этот guard.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
})
export class AppModule {}
