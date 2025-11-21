import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';

export interface LoadedTemplate {
  key: string;
  content: string;
}

@Injectable()
export class TemplateLoader {
  private cache = new Map<string, string>();
  private baseDir = this.getTemplatesPath();

  private getTemplatesPath(): string {
    // In production (Docker), files are in dist folder
    const distPath = join(
      process.cwd(),
      'dist',
      'apps',
      'notification-service',
      'email',
      'templates',
    );

    // In development, files are in src folder
    const srcPath = join(
      process.cwd(),
      'apps',
      'notification-service',
      'src',
      'email',
      'templates',
    );

    // Use dist path if it exists (production), otherwise use src path (development)
    return existsSync(distPath) ? distPath : srcPath;
  }

  async loadTemplate(templateKey: string): Promise<LoadedTemplate> {
    const cached = this.cache.get(templateKey);
    if (cached) {
      return { key: templateKey, content: cached };
    }
    const filename = `${templateKey}.mjml.hbs`;
    const filePath = join(this.baseDir, filename);
    const content = await fs.readFile(filePath, 'utf8');
    this.cache.set(templateKey, content);
    return { key: templateKey, content };
  }

  async verifyIntegrity(
    requiredKeys: string[],
  ): Promise<{ ok: boolean; missing: string[] }> {
    const missing: string[] = [];
    for (const key of requiredKeys) {
      try {
        await this.loadTemplate(key);
      } catch {
        missing.push(key);
      }
    }
    return { ok: missing.length === 0, missing };
  }
}
