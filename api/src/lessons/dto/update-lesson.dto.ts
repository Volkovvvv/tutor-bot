import { LessonStatus } from '@prisma/client'
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { MAX_PRICE_KOPECKS } from '../../common/money'

export class UpdateLessonDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  startsAt?: string

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  duration?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_KOPECKS)
  price?: number

  @IsOptional()
  @IsEnum(LessonStatus, { message: 'status: planned | done | cancelled' })
  status?: LessonStatus

  /**
   * Отметка оплаты. true — ставим текущее время, false — снимаем.
   * Дату клиент не присылает: момент оплаты фиксирует сервер,
   * иначе платёж можно задатировать и исказить отчёт за период.
   */
  @IsOptional()
  @IsBoolean()
  paid?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string
}
