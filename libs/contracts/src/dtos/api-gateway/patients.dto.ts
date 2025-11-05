import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../common';
import { Transform } from 'class-transformer';

const PATIENT_SORT_FIELDS = ['dateOfBirth', 'createdAt', 'updatedAt'];

export class ListPatientsQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(PATIENT_SORT_FIELDS as unknown as string[], {
    message: `sortBy must be one of: ${PATIENT_SORT_FIELDS.join(', ')}`,
  })
  declare sortBy?: (typeof PATIENT_SORT_FIELDS)[number];

  @IsOptional()
  @IsBoolean({ message: 'includedDeleted must be a boolean value' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  declare includedDeleted?: boolean;
}
