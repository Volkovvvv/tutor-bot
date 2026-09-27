import { IsISO8601, IsOptional } from 'class-validator'

export class SummaryQueryDto {
  /** Начало периода включительно. По умолчанию — начало текущего месяца. */
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string

  /** Конец периода исключительно. По умолчанию — начало следующего месяца. */
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string
}
