import { Type } from 'class-transformer'
import {
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

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateNotifySettingsDto)
  notify?: UpdateNotifySettingsDto
}
