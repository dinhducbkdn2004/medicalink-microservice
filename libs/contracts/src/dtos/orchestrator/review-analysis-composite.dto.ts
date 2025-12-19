import { IsOptional, IsEnum } from 'class-validator';
import { PaginationDto } from '../common';
import { DateRangeType } from '../content/analyze-review.dto';

export class ReviewAnalysisCompositeQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(DateRangeType)
  dateRange?: DateRangeType;
}

// Composite data with creator name populated
export interface ReviewAnalysisCompositeData {
  id: string;
  doctorId: string;
  dateRange: string;
  includeNonPublic: boolean;
  summary: string;
  createdBy: string;
  createdAt: Date;
  // Composed data from accounts service
  creatorName?: string;
}
