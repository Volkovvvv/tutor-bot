import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { MAX_PRICE_KOPECKS } from '../../common/money'
import { STUDY_GOALS, type StudyGoalValue } from './create-student.dto'

/**
 * Обновление карточки. Настройки уведомлений меняются отдельным
 * роутом: у них своя логика и свой размер, мешать их с ценой не нужно.
 *
 * Поля source/inviteStatus/userId клиент менять не может — их
 * проставляет только сервер по факту подключения ученика к боту.
 */
export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE_KOPECKS)
  price?: number

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string

  /** Класс, 1–11; null — сбросить. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(11)
  grade?: number | null

  @IsOptional()
  @IsIn(STUDY_GOALS)
  goal?: StudyGoalValue
}
