import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../common';

export class GetReviewsQueryDto extends PaginationDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isPublic?: boolean;
}
