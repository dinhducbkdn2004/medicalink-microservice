import { IsCuid } from '@app/contracts/decorators';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsString,
  IsOptional,
  IsEmail,
  Min,
  Max,
} from 'class-validator';

export class CreateReviewDto {
  @IsNumber({}, { message: 'Rating must be a number' })
  @Min(1, { message: 'Rating must be at least 1' })
  @Max(5, { message: 'Rating must be at most 5' })
  rating: number;

  @IsString({ message: 'Title must be a string' })
  @IsOptional()
  title?: string;

  @IsString({ message: 'Body must be a string' })
  @IsOptional()
  body?: string;

  @IsString({ message: 'Author name must be a string' })
  @IsOptional()
  authorName?: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  authorEmail?: string;

  @IsCuid({ message: 'Doctor ID must be a valid CUID' })
  doctorId: string;
}
