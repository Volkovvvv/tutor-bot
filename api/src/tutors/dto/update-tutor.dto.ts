import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { MAX_PRICE_KOPECKS } from '../../common/money'

export class UpdateTutorDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Имя не может быть пустым' })
  @MaxLength(100)
  displayName?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  subjects?: string[]

  /** Цена по умолчанию в копейках; null — сбросить. */
  @IsOptional()
  @IsInt({ message: 'Цена должна быть целым числом копеек' })
  @Min(0)
  @Max(MAX_PRICE_KOPECKS)
  defaultPrice?: number | null

  // Пределы — те же, что у настроек конкретного ученика
  // (students/dto/notify-settings.dto.ts): отсюда они туда и копируются.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(168)
  notifyBeforeHours?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  notifyBeforeMinutes?: number

  @IsOptional()
  @IsBoolean()
  notifyDebtReminder?: boolean

  /** true — отметить онбординг пройденным. Сбросить обратно нельзя. */
  @IsOptional()
  @IsBoolean()
  onboarded?: boolean
}
