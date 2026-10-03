import { Type } from 'class-transformer'
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { MAX_PRICE_KOPECKS } from '../../common/money'
import { UpdateNotifySettingsDto } from './notify-settings.dto'

export const STUDY_GOALS = ['SCHOOL', 'OGE', 'EGE', 'CE', 'CT'] as const
export type StudyGoalValue = (typeof STUDY_GOALS)[number]

export class CreateStudentDto {
  @IsString()
  @MinLength(1, { message: 'Имя не может быть пустым' })
  @MaxLength(100)
  name!: string

  /** Цена занятия в копейках: 1500 руб. = 150000. */
  @IsInt({ message: 'Цена должна быть целым числом копеек' })
  @Min(0)
  @Max(MAX_PRICE_KOPECKS)
  price!: number

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string

  /** Класс, 1–11; null — не указан. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(11)
  grade?: number | null

  /** К чему готовится: под это ИИ собирает материалы урока. */
  @IsOptional()
  @IsIn(STUDY_GOALS)
  goal?: StudyGoalValue

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateNotifySettingsDto)
  notify?: UpdateNotifySettingsDto
}
