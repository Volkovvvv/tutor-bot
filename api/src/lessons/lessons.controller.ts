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
import type { AuthUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { CreateLessonDto } from './dto/create-lesson.dto'
import { ListLessonsDto } from './dto/list-lessons.dto'
import { SummaryQueryDto } from './dto/summary.dto'
import { UpdateLessonDto } from './dto/update-lesson.dto'
import { LessonsService, type LessonsSummary, type LessonView } from './lessons.service'

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

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
