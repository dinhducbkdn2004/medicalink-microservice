import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewRepository } from './review.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetsModule } from '../assets/assets.module';
import { MicroserviceClientsModule } from '../clients/microservice-clients.module';

@Module({
  imports: [AssetsModule, MicroserviceClientsModule],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewRepository, PrismaService],
  exports: [ReviewsService, ReviewRepository],
})
export class ReviewsModule {}
