import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QuestionResponseDto,
  AnswerResponseDto,
  CreateQuestionDto,
  UpdateQuestionDto,
  QAStatsOverviewDto,
} from '@app/contracts';
import { extractAllPublicIdsFromText } from '@app/commons/utils';
import { QuestionStatus } from 'apps/content-service/prisma/generated/client';
import { removeHtmlTags, shortenText } from '@app/commons/utils/text-format';
import { SCreateAnswerDto } from './dtos/s-create-answer-dto';

@Injectable()
export class QuestionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createQuestion(data: CreateQuestionDto): Promise<QuestionResponseDto> {
    const question = await this.prisma.question.create({
      data: {
        title: data.title,
        body: data.body,
        authorName: data.authorName ?? undefined,
        authorEmail: data.authorEmail ?? undefined,
        specialtyId: data.specialtyId ?? undefined,
        status: 'PENDING',
      },
    });

    const publicIds = extractAllPublicIdsFromText(data.body);

    // Persist assets if provided
    if (Array.isArray(publicIds)) {
      await this.setEntityAssets('QUESTION', question.id, publicIds);
    }
    return this.transformQuestionResponse(question, publicIds);
  }

  async findAllQuestions(params: {
    page: number;
    limit: number;
    authorEmail?: string;
    specialtyId?: string;
    status?: QuestionStatus;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page,
      limit,
      authorEmail,
      specialtyId,
      status,
      search,
      sortBy,
      sortOrder,
    } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (authorEmail) where.authorEmail = authorEmail;
    if (specialtyId) where.specialtyId = specialtyId;
    if (status) where.status = status;
    if (search && typeof search === 'string' && search.trim().length > 0) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
        { authorName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Whitelist sort fields to avoid SQL injection via Prisma keys
    const allowedSortFields = new Set<string>([
      'createdAt',
      'updatedAt',
      'viewCount',
      'title',
      'status',
    ]);
    const resolvedSortBy = allowedSortFields.has(String(sortBy || ''))
      ? (sortBy as string)
      : 'createdAt';
    const resolvedSortOrder: 'asc' | 'desc' =
      sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : 'desc';

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [resolvedSortBy]: resolvedSortOrder,
        } as any,
      }),
      this.prisma.question.count({ where }),
    ]);

    const dataWithExtras = await Promise.all(
      questions.map(async (question) => {
        const [publicIds, answersCount, acceptedAnswersCount] =
          await Promise.all([
            this.getPublicIdsForEntity('QUESTION', question.id),
            this.prisma.answer.count({ where: { questionId: question.id } }),
            this.prisma.answer.count({
              where: { questionId: question.id, isAccepted: true },
            }),
          ]);
        return {
          question,
          publicIds,
          answersCount,
          acceptedAnswersCount,
        };
      }),
    );

    return {
      data: dataWithExtras.map(
        ({ question, publicIds, answersCount, acceptedAnswersCount }) =>
          this.transformQuestionResponse(
            question,
            publicIds,
            true,
            answersCount,
            acceptedAnswersCount,
          ),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateQuestion(
    id: string,
    data: UpdateQuestionDto,
  ): Promise<QuestionResponseDto> {
    const updateData: any = {};

    if (data.specialtyId !== undefined)
      updateData.specialtyId = data.specialtyId;
    if (data.status !== undefined) updateData.status = data.status;

    const question = await this.prisma.question.update({
      where: { id },
      data: updateData,
    });

    const publicIds = await this.getPublicIdsForEntity('QUESTION', question.id);

    return this.transformQuestionResponse(question, publicIds);
  }

  async findQuestionById(id: string): Promise<QuestionResponseDto | null> {
    const question = await this.prisma.question.findUnique({
      where: { id },
    });

    if (!question) return null;
    const [publicIds, answersCount, acceptedAnswersCount] = await Promise.all([
      this.getPublicIdsForEntity('QUESTION', question.id),
      this.prisma.answer.count({ where: { questionId: question.id } }),
      this.prisma.answer.count({
        where: { questionId: question.id, isAccepted: true },
      }),
    ]);

    return this.transformQuestionResponse(
      question,
      publicIds,
      false,
      answersCount,
      acceptedAnswersCount,
    );
  }

  async deleteQuestion(id: string): Promise<void> {
    await this.prisma.question.delete({
      where: { id },
    });
    await this.prisma.asset.deleteMany({
      where: { entityType: 'QUESTION', entityId: id },
    });
  }

  async incrementViewCount(id: string): Promise<void> {
    await this.prisma.question.update({
      where: { id },
      data: { viewCount: { increment: 1 } } as unknown as any,
      select: { id: true },
    });
  }

  async updateAnsweredStatus(id: string, status: string): Promise<void> {
    await this.prisma.question.update({
      where: { id },
      data: {
        status: status as any,
      },
    });
  }

  async createAnswer(data: SCreateAnswerDto): Promise<AnswerResponseDto> {
    const answer = await this.prisma.answer.create({
      data: {
        body: data.body,
        questionId: data.questionId,
        authorId: data.authorId,
        isAccepted: false,
      },
    });

    return this.transformAnswerResponse(answer);
  }

  async findAnswersByQuestionId(
    questionId: string,
  ): Promise<AnswerResponseDto[]> {
    const answers = await this.prisma.answer.findMany({
      where: { questionId },
      orderBy: [{ isAccepted: 'desc' }, { createdAt: 'asc' }],
    });

    return answers.map((answer) => this.transformAnswerResponse(answer));
  }

  async findAnswerById(id: string): Promise<AnswerResponseDto | null> {
    const answer = await this.prisma.answer.findUnique({
      where: { id },
    });

    return answer ? this.transformAnswerResponse(answer) : null;
  }

  async findAllAnswers(params: {
    page: number;
    limit: number;
    questionId?: string;
    authorId?: string;
    isAccepted?: boolean;
  }): Promise<{
    data: AnswerResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page, limit, questionId, authorId, isAccepted } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (questionId) where.questionId = questionId;
    if (authorId) where.authorId = authorId;
    if (isAccepted !== undefined) where.isAccepted = isAccepted;

    const [answers, total] = await Promise.all([
      this.prisma.answer.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isAccepted: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.answer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: answers.map((answer) => this.transformAnswerResponse(answer)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async updateAnswer(
    id: string,
    data: {
      body?: string;
      isAccepted?: boolean;
    },
  ): Promise<AnswerResponseDto> {
    const answer = await this.prisma.answer.update({
      where: { id },
      data,
    });

    return this.transformAnswerResponse(answer);
  }

  async deleteAnswer(id: string): Promise<void> {
    await this.prisma.answer.delete({
      where: { id },
    });
  }

  async acceptAnswer(id: string): Promise<void> {
    const answer = await this.prisma.answer.findUnique({
      where: { id },
      select: { questionId: true },
    });

    if (!answer) return;

    await this.prisma.$transaction([
      this.prisma.answer.update({
        where: { id },
        data: { isAccepted: true },
      }),
      this.prisma.question.update({
        where: { id: answer.questionId },
        data: { status: 'ANSWERED' },
      }),
    ]);
  }

  async countAnswersByQuestion(questionId: string): Promise<number> {
    return await this.prisma.answer.count({
      where: { questionId },
    });
  }

  async getQaOverview(): Promise<QAStatsOverviewDto> {
    const [totalQuestions, answeredQuestions] = await Promise.all([
      this.prisma.question.count(),
      this.prisma.question.count({
        where: { status: 'ANSWERED' },
      }),
    ]);

    const answerRate =
      totalQuestions === 0
        ? 0
        : Number(((answeredQuestions / totalQuestions) * 100).toFixed(2));

    return {
      totalQuestions,
      answeredQuestions,
      answerRate,
    };
  }

  private transformQuestionResponse(
    question: any,
    publicIds?: string[],
    simplifyBody: boolean = false,
    answersCount?: number,
    acceptedAnswersCount?: number,
  ): QuestionResponseDto {
    const body = simplifyBody
      ? // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        shortenText(removeHtmlTags(question.body), 200, {
          keepWord: true,
          ellipsis: true,
        })
      : question.body;
    return {
      id: question.id,
      title: question.title,
      body,
      authorName: question.authorName,
      authorEmail: question.authorEmail,
      specialtyId: question.specialtyId,
      publicIds,
      status: question.status,
      viewCount: question.viewCount,
      answersCount,
      acceptedAnswersCount,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }

  private transformAnswerResponse(answer: any): AnswerResponseDto {
    return {
      id: answer.id,
      body: answer.body,
      authorId: answer.authorId,
      questionId: answer.questionId,
      isAccepted: answer.isAccepted,
      createdAt: answer.createdAt,
      updatedAt: answer.updatedAt,
    };
  }

  private async getPublicIdsForEntity(
    entityType: 'BLOG' | 'QUESTION' | 'REVIEW',
    entityId: string,
  ): Promise<string[]> {
    const assets = await this.prisma.asset.findMany({
      where: { entityType, entityId },
      select: { publicId: true },
      orderBy: { createdAt: 'asc' },
    });
    return assets.map((a) => a.publicId);
  }

  private async setEntityAssets(
    entityType: 'BLOG' | 'QUESTION' | 'REVIEW',
    entityId: string,
    publicIds: string[],
  ): Promise<void> {
    const desired = this.normalizePublicIds(publicIds);
    const existingAssets = await this.prisma.asset.findMany({
      where: { entityType, entityId },
      select: { publicId: true },
    });

    const existing = existingAssets.filter(
      (a) => typeof a.publicId === 'string',
    ) as Array<{ publicId: string }>;

    const existingSet = new Set(existing.map((a) => a.publicId));

    const toRemove = existing
      .filter((a) => !desired.includes(a.publicId))
      .map((a) => a.publicId);
    const toAdd = desired.filter((id) => !existingSet.has(id));

    if (toRemove.length > 0) {
      await this.prisma.asset.deleteMany({
        where: { publicId: { in: toRemove } },
      });
    }

    for (const publicId of toAdd) {
      await this.prisma.asset.upsert({
        where: { publicId },
        update: { entityType, entityId },
        create: { publicId, entityType, entityId },
      });
    }
  }

  private normalizePublicIds(publicIds?: string[] | null): string[] {
    const ids = (publicIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0,
    );
    return Array.from(new Set<string>(ids));
  }
}
