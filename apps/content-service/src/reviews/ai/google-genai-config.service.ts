import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GoogleGenAIConfig {
  apiKey: string;
  model: string;
  timeout: number;
}

@Injectable()
export class GoogleGenAIConfigService {
  constructor(private readonly config: ConfigService) {}

  getConfig(): GoogleGenAIConfig {
    const apiKey = this.config.get<string>('GOOGLE_GENAI_API_KEY');
    const model = this.config.get<string>('GOOGLE_GENAI_MODEL', 'gemini-pro');
    const timeout = Number(
      this.config.get<string>('GOOGLE_GENAI_TIMEOUT', '30000'),
    );

    if (!apiKey) {
      throw new Error('Missing GOOGLE_GENAI_API_KEY environment variable');
    }

    return {
      apiKey,
      model,
      timeout,
    };
  }
}
