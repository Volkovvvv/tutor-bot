import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { HOMEWORK_COUNTS, WISHES_MAX } from '../material-content'

export class GenerateMaterialDto {
  @IsString()
  @MinLength(1, { message: 'Выберите предмет' })
  @MaxLength(60)
  subject!: string

  @IsString()
  @MinLength(2, { message: 'Напишите тему урока' })
  @MaxLength(200)
  topic!: string

  /** Пожелания репетитора к материалу свободным текстом: уходят в промпт. */
  @IsOptional()
  @IsString()
  @MaxLength(WISHES_MAX, { message: `Пожелания — не длиннее ${WISHES_MAX} символов` })
  wishes?: string

  /** Сколько заданий в домашке; по умолчанию 6. */
  @IsOptional()
  @IsIn(HOMEWORK_COUNTS, { message: 'В домашке может быть 4, 6 или 10 заданий' })
  homeworkCount?: number
}

export class PdfLinkDto {
  /** true — версия для репетитора, со страницей ответов. */
  @IsOptional()
  @IsBoolean()
  answers?: boolean
}

export class UpdateMaterialDto {
  /**
   * Материал после правок репетитора, целиком. Форму проверяет
   * coerceContent — та же функция, что разбирает ответ ИИ.
   */
  @IsObject()
  content!: Record<string, unknown>
}
