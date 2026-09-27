import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from 'class-validator'

/** Формат "ЧЧ:ММ" — 24-часовой, с ведущим нулём. */
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export class UpdateNotifySettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  /**
   * За сколько часов до занятия напомнить. 0 — выключено.
   * Предел 168 часов (неделя): больше не имеет смысла,
   * а заодно защищает планировщик от абсурдных значений.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(168)
  beforeHours?: number

  /** Второе напоминание за N минут до начала. 0 — выключено. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  beforeMinutes?: number

  @IsOptional()
  @IsBoolean()
  debtReminder?: boolean

  // Окно тишины уходит в планировщик, поэтому формат проверяем строго:
  // строка вида "25:99" тихо сломала бы отправку напоминаний.
  @IsOptional()
  @Matches(TIME_RE, { message: 'quietFrom должен быть в формате ЧЧ:ММ' })
  quietFrom?: string

  @IsOptional()
  @Matches(TIME_RE, { message: 'quietTo должен быть в формате ЧЧ:ММ' })
  quietTo?: string
}
