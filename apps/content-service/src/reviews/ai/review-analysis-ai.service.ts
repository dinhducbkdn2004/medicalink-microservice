import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenAIProvider } from './google-genai.provider';
import { PromptBuilderService, PeriodData } from './prompt-builder.service';
import { InfraUnavailableError } from '@app/domain-errors';

export interface AIAnalysisResult {
  summary: string;
  advantages: string;
  disadvantages: string;
  changes: string;
  recommendations: string;
}

@Injectable()
export class ReviewAnalysisAIService {
  private readonly logger = new Logger(ReviewAnalysisAIService.name);

  constructor(
    private readonly genAIProvider: GoogleGenAIProvider,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  async analyzeReviews(
    period1: PeriodData,
    period2: PeriodData,
    totalChange: number,
    avgChange: number,
    dateRange: 'mtd' | 'ytd',
  ): Promise<AIAnalysisResult> {
    try {
      const prompt = this.promptBuilder.buildAnalysisPrompt(
        period1,
        period2,
        totalChange,
        avgChange,
        dateRange,
      );

      const model = this.genAIProvider.getModel();
      const timeout = this.genAIProvider.getTimeout();

      this.logger.log('Sending analysis request to Google Generative AI');

      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI request timeout')), timeout),
      );

      // Race between AI request and timeout
      const result = await Promise.race([
        model.generateContent(prompt),
        timeoutPromise,
      ]);

      const response = result.response;
      const text = response.text();

      this.logger.log('Received response from Google Generative AI');

      // Parse JSON response - guaranteed valid JSON with structured output
      const analysisResult = this.parseAIResponse(text);
      return analysisResult;
    } catch (error) {
      this.logger.error('Failed to analyze reviews with AI', error);
      throw new InfraUnavailableError(
        'AI analysis service temporarily unavailable. Please try again later.',
      );
    }
  }

  private parseAIResponse(text: string): AIAnalysisResult {
    try {
      // With structured output, we get guaranteed valid JSON
      const parsed = JSON.parse(text);

      return {
        summary: parsed.summary || '<p>No summary available</p>',
        advantages:
          parsed.advantages || '<ul><li>No advantages identified</li></ul>',
        disadvantages:
          parsed.disadvantages ||
          '<ul><li>No disadvantages identified</li></ul>',
        changes: parsed.changes || '<p>No significant changes observed</p>',
        recommendations:
          parsed.recommendations ||
          '<ul><li>No recommendations available</li></ul>',
      };
    } catch (error) {
      this.logger.error('Failed to parse AI response as JSON', error);
      // This should rarely happen with structured output
      throw new InfraUnavailableError(
        'Failed to parse AI analysis response. Please try again.',
      );
    }
  }
}
