import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BlogCompositeService } from './blog-composite.service';
import {
  BlogCompositeQueryDto,
  BlogPublicCompositeQueryDto,
} from '@app/contracts/dtos';
import { ORCHESTRATOR_PATTERNS } from '@app/contracts/patterns';

@Controller()
export class BlogCompositeController {
  constructor(private readonly blogCompositeService: BlogCompositeService) {}

  /**
   * Get single blog with composed data
   */
  @MessagePattern(ORCHESTRATOR_PATTERNS.BLOG_GET_COMPOSITE)
  async getComposite(@Payload() payload: { id: string }) {
    return this.blogCompositeService.getComposite(payload.id);
  }

  /**
   * Get published blog by slug with composed data (for public access)
   */
  @MessagePattern(ORCHESTRATOR_PATTERNS.BLOG_PUBLIC_GET_COMPOSITE)
  async getPublishedBySlug(
    @Payload() payload: { slug: string; increaseView?: boolean },
  ) {
    return this.blogCompositeService.getPublishedBySlug(payload.slug, {
      increaseView: payload.increaseView,
    });
  }

  /**
   * List blogs with composed data (admin/manager view)
   */
  @MessagePattern(ORCHESTRATOR_PATTERNS.BLOG_LIST_COMPOSITE)
  async listComposite(@Payload() query: BlogCompositeQueryDto) {
    return this.blogCompositeService.listComposite(query);
  }

  /**
   * List published blogs with composed data (public view)
   */
  @MessagePattern(ORCHESTRATOR_PATTERNS.BLOG_PUBLIC_LIST_COMPOSITE)
  async listPublicComposite(@Payload() query: BlogPublicCompositeQueryDto) {
    return this.blogCompositeService.listPublicComposite(query);
  }
}
