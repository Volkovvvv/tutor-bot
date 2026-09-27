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
import { CreateStudentDto } from './dto/create-student.dto'
import { ListStudentsDto } from './dto/list-students.dto'
import { UpdateNotifySettingsDto } from './dto/notify-settings.dto'
import { UpdateStudentDto } from './dto/update-student.dto'
import { StudentsService, type StudentView } from './students.service'

/**
 * Все роуты закрыты глобальным JwtAuthGuard.
 *
 * tutorId берётся только из токена — никогда из параметров запроса.
 * Клиент физически не может попросить данные другого кабинета.
 */
@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListStudentsDto): Promise<StudentView[]> {
    return this.students.list(user.tutorId, query)
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    // ParseUUIDPipe отсекает мусор до похода в базу.
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentView> {
    return this.students.findOne(user.tutorId, id)
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStudentDto): Promise<StudentView> {
    return this.students.create(user.tutorId, dto)
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
  ): Promise<StudentView> {
    return this.students.update(user.tutorId, id, dto)
  }

  @Patch(':id/notify')
  updateNotify(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNotifySettingsDto,
  ): Promise<StudentView> {
    return this.students.updateNotify(user.tutorId, id, dto)
  }

  /** Архивация: ученик исчезает из списка, история занятий остаётся. */
  @Post(':id/archive')
  archive(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentView> {
    return this.students.archive(user.tutorId, id)
  }

  @Post(':id/restore')
  restore(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentView> {
    return this.students.restore(user.tutorId, id)
  }

  /** Удаление насовсем — разрешено только пока нет занятий. */
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ deleted: true }> {
    return this.students.remove(user.tutorId, id)
  }
}
