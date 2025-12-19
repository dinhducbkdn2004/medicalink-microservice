import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewRepository } from './review.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetsModule } from '../assets/assets.module';
import { MicroserviceClientsModule } from '../clients/microservice-clients.module';
import { GoogleGenAIConfigService } from './ai/google-genai-config.service';
import { GoogleGenAIProvider } from './ai/google-genai.provider';
import { PromptBuilderService } from './ai/prompt-builder.service';
import { ReviewAnalysisAIService } from './ai/review-analysis-ai.service';

@Module({
  imports: [ConfigModule, AssetsModule, MicroserviceClientsModule],
  controllers: [ReviewsController],
  providers: [
    ReviewsService,
    ReviewRepository,
    PrismaService,
    GoogleGenAIConfigService,
    GoogleGenAIProvider,
    PromptBuilderService,
    ReviewAnalysisAIService,
  ],
  exports: [ReviewsService, ReviewRepository],
})
export class ReviewsModule {}
