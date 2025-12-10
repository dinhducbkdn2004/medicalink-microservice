import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { QuestionCompositeService } from './question-composite.service';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';
import { GetQuestionsQueryDto, GetAnswersQueryDto } from '@app/contracts/dtos';

@Controller()
export class QuestionCompositeController {
  constructor(
    private readonly questionCompositeService: QuestionCompositeService,
  ) {}

  @MessagePattern(ORCHESTRATOR_PATTERNS.QUESTION_GET_COMPOSITE)
  async getQuestionComposite(
    @Payload()
    payload: {
      id: string;
      skipCache?: boolean;
      increaseView?: boolean;
    },
  ) {
    return this.questionCompositeService.getComposite(payload.id, {
      skipCache: payload.skipCache,
      increaseView: payload.increaseView,
    });
  }

  @MessagePattern(ORCHESTRATOR_PATTERNS.QUESTION_LIST_COMPOSITE)
  async listQuestionsComposite(
    @Payload() query: GetQuestionsQueryDto & { skipCache?: boolean },
  ) {
    const { skipCache, ...queryParams } = query;
    return this.questionCompositeService.listComposite(
      queryParams as GetQuestionsQueryDto,
      { skipCache },
    );
  }

  @MessagePattern(ORCHESTRATOR_PATTERNS.ANSWERS_LIST_COMPOSITE)
  async listAnswersComposite(
    @Payload() query: GetAnswersQueryDto & { skipCache?: boolean },
  ) {
    const { skipCache, ...queryParams } = query;
    return this.questionCompositeService.listAnswersComposite(
      queryParams as GetAnswersQueryDto,
      { skipCache },
    );
  }
}
