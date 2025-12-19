import { IsOptional, IsEnum } from 'class-validator';
import { DateRangeType } from './analyze-review.dto';
import { PaginationDto } from '../common';

export class GetReviewAnalysesQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(DateRangeType)
  dateRange?: DateRangeType;
}
