import { CreateAnswerDto } from './create-answer.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAnswerDto extends CreateAnswerDto {
  @IsOptional()
  @IsBoolean()
  isAccepted?: boolean;
}
