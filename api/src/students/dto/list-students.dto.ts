import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class ListStudentsDto extends PaginationDto {
  /** По умолчанию архивные скрыты — их показывают явным запросом. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean
}
