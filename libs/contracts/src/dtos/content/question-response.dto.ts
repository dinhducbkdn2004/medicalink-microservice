export interface QuestionResponseDto {
  id: string;
  title: string;
  body: string;
  authorName?: string;
  authorEmail?: string;
  specialtyId?: string;
  publicIds?: string[];
  status: string;
  viewCount?: number;
  answersCount?: number;
  acceptedAnswersCount?: number;
  createdAt: Date;
  updatedAt: Date;
}
