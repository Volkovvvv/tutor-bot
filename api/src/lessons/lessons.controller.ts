import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { AuthUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { CreateLessonDto } from './dto/create-lesson.dto'
import { BulkLessonsDto, RecognizeScheduleDto } from './dto/import-schedule.dto'
import { ListLessonsDto } from './dto/list-lessons.dto'
import { CreateSeriesDto, StopSeriesDto } from './dto/series.dto'
import { SummaryQueryDto } from './dto/summary.dto'
import { UpdateLessonDto } from './dto/update-lesson.dto'
import { LessonSeriesService } from './lesson-series.service'
import { LessonsService, type LessonsSummary, type LessonView } from './lessons.service'
import type { ImportRow } from './schedule-import'
import { ScheduleImportService } from './schedule-import.service'

@Controller('lessons')
export class LessonsController {
  constructor(
    private readonly lessons: LessonsService,
    private readonly scheduleImport: ScheduleImportService,
    private readonly series: LessonSeriesService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListLessonsDto): Promise<LessonView[]> {
    return this.lessons.list(user.tutorId, query)
  }

  /**
   * Итоги за период. Объявлен до ':id', иначе Nest примет
   * слово "summary" за идентификатор занятия.
   */
  @Get('summary')
  summary(
    @CurrentUser() user: AuthUser,
    @Query() query: SummaryQueryDto,
  ): Promise<LessonsSummary> {
    return this.lessons.summary(user.tutorId, query)
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LessonView> {
    return this.lessons.findOne(user.tutorId, id)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLessonDto): Promise<LessonView> {
    return this.lessons.create(user.tutorId, dto)
  }

  // Каждое распознавание — запрос к ИИ с картинкой: один активный
  // пользователь не должен выбрать лимит ключа.
  @Throttle({ default: { limit: 20, ttl: 60 * 60_000 } })
  @Post('import/recognize')
  recognize(@Body() dto: RecognizeScheduleDto): Promise<{ rows: ImportRow[] }> {
    return this.scheduleImport.recognize(dto)
  }

  /** Расписание на недели вперёд одним запросом: по одному занятию оно упёрлось бы в лимит частоты. */
  @Post('bulk')
  createMany(
    @CurrentUser() user: AuthUser,
    @Body() dto: BulkLessonsDto,
  ): Promise<{ created: LessonView[]; skipped: number }> {
    return this.lessons.createMany(user.tutorId, dto)
  }

  /** Занятия «каждую неделю»: каждая запись — первое занятие своей серии. */
  @Post('series')
  createSeries(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSeriesDto,
  ): Promise<{ created: LessonView[]; skipped: number }> {
    return this.series.create(user.tutorId, dto)
  }

  /** Обрывает серию с момента from: запланированные занятия после него удаляются. */
  @Delete('series/:id')
  stopSeries(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: StopSeriesDto,
  ): Promise<{ deletedIds: string[] }> {
    return this.series.stop(user.tutorId, id, new Date(query.from))
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonDto,
  ): Promise<LessonView> {
    return this.lessons.update(user.tutorId, id, dto)
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ deleted: true }> {
    return this.lessons.remove(user.tutorId, id)
  }
}
