import { IsCuid } from '@app/contracts/decorators';
import { IsEnum, IsBoolean, IsOptional } from 'class-validator';

export enum DateRangeType {
  MTD = 'mtd',
  YTD = 'ytd',
}

export class AnalyzeReviewDto {
  @IsCuid({ message: 'Doctor ID must be a valid CUID' })
  doctorId: string;

  @IsEnum(DateRangeType, {
    message: 'Date range must be either "mtd" or "ytd"',
  })
  dateRange: DateRangeType;

  @IsBoolean({ message: 'includeNonPublic must be a boolean' })
  @IsOptional()
  includeNonPublic?: boolean = false;
}
