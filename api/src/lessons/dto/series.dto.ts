import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsISO8601, ValidateNested } from 'class-validator'
import { IMPORT_ROWS_MAX } from '../schedule-import'
import { CreateLessonDto } from './create-lesson.dto'

/**
 * Серии «каждую неделю». Элемент — первое занятие серии в том же виде,
 * что и разовое: startsAt задаёт день недели и время остальных.
 */
export class CreateSeriesDto {
  @IsArray()
  @ArrayMinSize(1)
  // Столько строк бывает в распознанном расписании — больше за раз не приходит
  @ArrayMaxSize(IMPORT_ROWS_MAX)
  @ValidateNested({ each: true })
  @Type(() => CreateLessonDto)
  series!: CreateLessonDto[]
}

export class StopSeriesDto {
  /** С какого момента занятий больше нет: начало занятия, с которого серию обрывают. */
  @IsISO8601({ strict: true }, { message: 'from должен быть датой ISO 8601' })
  from!: string
}
