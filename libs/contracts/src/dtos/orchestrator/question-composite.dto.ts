import { QuestionResponseDto, AnswerResponseDto } from '../content';

export interface QuestionCompositeData extends QuestionResponseDto {
  specialty?: {
    name: string;
    slug: string;
  };
}

export interface AnswerCompositeData extends AnswerResponseDto {
  authorFullName?: string;
}

export interface QuestionWithAnswersCompositeData
  extends QuestionCompositeData {
  answers?: AnswerCompositeData[];
}
