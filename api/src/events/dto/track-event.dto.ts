import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { CLIENT_EVENTS } from '../event-names'

export class TrackEventDto {
  @IsIn(CLIENT_EVENTS)
  name!: (typeof CLIENT_EVENTS)[number]

  @IsOptional()
  @IsObject()
  props?: Record<string, unknown>
}

export class FeedbackDto {
  @IsString()
  @MinLength(2, { message: 'Напишите, что случилось или что улучшить' })
  @MaxLength(2000)
  text!: string

  /** Экран, с которого написали: today, lesson… */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  screen?: string
}
