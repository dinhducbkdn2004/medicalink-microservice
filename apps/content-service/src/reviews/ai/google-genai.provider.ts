import { Injectable } from '@nestjs/common';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  SchemaType,
} from '@google/generative-ai';
import { GoogleGenAIConfigService } from './google-genai-config.service';

@Injectable()
export class GoogleGenAIProvider {
  private model: GenerativeModel;
  private timeout: number;

  constructor(private readonly configService: GoogleGenAIConfigService) {
    const config = this.configService.getConfig();
    const genAI = new GoogleGenerativeAI(config.apiKey);

    // Configure model with structured output
    this.model = genAI.getGenerativeModel({
      model: config.model,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            summary: {
              type: SchemaType.STRING,
              description:
                'Brief overview in HTML format with <p>, <strong> tags',
            },
            advantages: {
              type: SchemaType.STRING,
              description:
                'Key strengths in HTML format with <ul>, <li>, <strong> tags',
            },
            disadvantages: {
              type: SchemaType.STRING,
              description:
                'Areas of concern in HTML format with <ul>, <li>, <strong> tags',
            },
            changes: {
              type: SchemaType.STRING,
              description:
                'Notable changes in HTML format with <p>, <strong> tags',
            },
            recommendations: {
              type: SchemaType.STRING,
              description:
                'Actionable recommendations in HTML format with <ul>, <li>, <strong> tags',
            },
          },
          required: [
            'summary',
            'advantages',
            'disadvantages',
            'changes',
            'recommendations',
          ],
        },
      },
    });

    this.timeout = config.timeout;
  }

  getModel(): GenerativeModel {
    return this.model;
  }

  getTimeout(): number {
    return this.timeout;
  }
}
