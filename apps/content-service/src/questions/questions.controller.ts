import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { QuestionsService } from './questions.service';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  UpdateAnswerDto,
  GetQuestionsQueryDto,
} from '@app/contracts/dtos/content';
import { QUESTIONS_PATTERNS, ANSWERS_PATTERNS } from '@app/contracts/patterns';
import { SCreateAnswerDto } from './dtos/s-create-answer-dto';

@Controller()
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @MessagePattern(QUESTIONS_PATTERNS.CREATE)
  create(@Payload() createQuestionDto: CreateQuestionDto) {
    return this.questionsService.createQuestion(createQuestionDto);
  }

  @MessagePattern(QUESTIONS_PATTERNS.GET_LIST)
  findAll(@Payload() payload: GetQuestionsQueryDto) {
    return this.questionsService.getQuestions(payload);
  }

  @MessagePattern(QUESTIONS_PATTERNS.GET_BY_ID)
  findOne(@Payload() data: { id: string }) {
    return this.questionsService.getQuestionById(data.id);
  }

  @MessagePattern(QUESTIONS_PATTERNS.UPDATE)
  update(
    @Payload()
    data: {
      id: string;
      updateQuestionDto: UpdateQuestionDto;
    },
  ) {
    return this.questionsService.updateQuestion(
      data.id,
      data.updateQuestionDto,
    );
  }

  @MessagePattern(QUESTIONS_PATTERNS.DELETE)
  remove(@Payload() data: { id: string }) {
    return this.questionsService.deleteQuestion(data.id);
  }

  @MessagePattern(ANSWERS_PATTERNS.CREATE)
  createAnswer(@Payload() createAnswerDto: SCreateAnswerDto) {
    return this.questionsService.createAnswer(createAnswerDto);
  }

  @MessagePattern(ANSWERS_PATTERNS.GET_LIST)
  getAnswers(
    @Payload()
    data: {
      page?: number;
      limit?: number;
      questionId?: string;
      authorId?: string;
      isAccepted?: boolean;
    },
  ) {
    const {
      page = 1,
      limit = 10,
      questionId,
      authorId,
      isAccepted,
    } = data || {};
    return this.questionsService.getAnswers({
      page,
      limit,
      questionId,
      authorId,
      isAccepted,
    });
  }

  @MessagePattern(ANSWERS_PATTERNS.GET_BY_ID)
  getAnswerById(@Payload() data: { id: string }) {
    return this.questionsService.getAnswerById(data.id);
  }

  @MessagePattern(ANSWERS_PATTERNS.UPDATE)
  updateAnswer(
    @Payload()
    data: {
      id: string;
      updateAnswerDto: UpdateAnswerDto;
    },
  ) {
    return this.questionsService.updateAnswer(data.id, data.updateAnswerDto);
  }

  @MessagePattern(ANSWERS_PATTERNS.DELETE)
  deleteAnswer(@Payload() data: { id: string }) {
    return this.questionsService.deleteAnswer(data.id);
  }
}
