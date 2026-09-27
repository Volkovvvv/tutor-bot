import { LessonStatus } from '@prisma/client'
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class ListLessonsDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  studentId?: string

  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus

  /** Начало периода включительно. */
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string

  /** Конец периода исключительно. */
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string
}
