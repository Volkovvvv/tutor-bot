import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { MAX_PRICE_KOPECKS } from '../../common/money'

export class CreateLessonDto {
  @IsUUID()
  studentId!: string

  /**
   * Момент начала в ISO 8601 со смещением: "2026-10-01T16:00:00+03:00".
   * Строка без зоны неоднозначна — планировщик не сможет понять,
   * когда занятие наступает на самом деле.
   */
  @IsISO8601({ strict: true }, { message: 'startsAt должен быть датой ISO 8601' })
  startsAt!: string

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(600)
  duration?: number

  /**
   * Цена этого занятия в копейках. Не передана — берётся из карточки
   * ученика и фиксируется навсегда (см. lessons.service.ts).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_KOPECKS)
  price?: number

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string
}
