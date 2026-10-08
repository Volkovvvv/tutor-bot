import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator'
import { IMPORT_IMAGE_MAX, IMPORT_IMAGE_PATTERN, IMPORT_TEXT_MAX } from '../schedule-import'
import { CreateLessonDto } from './create-lesson.dto'

// Разовые занятия пачкой — неделя распознанного расписания, до 60 строк.
// Запас — на клиента, который шлёт несколько недель сразу; повтор
// «каждую неделю» идёт не сюда, а через серии (POST /lessons/series).
export const BULK_LESSONS_MAX = 300

/** Расписание для распознавания: фото, текст или оба сразу. */
export class RecognizeScheduleDto {
  /** Фото как data URL: "data:image/jpeg;base64,…". */
  @IsOptional()
  @IsString()
  @MaxLength(IMPORT_IMAGE_MAX, { message: 'Фото слишком большое' })
  @Matches(IMPORT_IMAGE_PATTERN, { message: 'Фото должно быть картинкой JPEG, PNG или WebP' })
  image?: string

  @IsOptional()
  @IsString()
  @MaxLength(IMPORT_TEXT_MAX)
  text?: string
}

export class BulkLessonsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_LESSONS_MAX, { message: `За один раз — не больше ${BULK_LESSONS_MAX} занятий` })
  @ValidateNested({ each: true })
  @Type(() => CreateLessonDto)
  lessons!: CreateLessonDto[]
}
