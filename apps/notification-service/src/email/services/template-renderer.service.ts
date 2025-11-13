import { Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';
import mjml2html from 'mjml';
import { TemplateLoader } from './template-loader.service';
import { join } from 'path';
import { promises as fs } from 'fs';

@Injectable()
export class TemplateRenderer {
  private partialsRegistered = false;

  constructor(private readonly loader: TemplateLoader) {}

  private async registerPartialsOnce(): Promise<void> {
    if (this.partialsRegistered) return;
    const partialsDir = join(
      process.cwd(),
      'apps',
      'notification-service',
      'src',
      'email',
      'templates',
      'partials',
    );
    try {
      const entries = await fs.readdir(partialsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.hbs')) {
          const key = entry.name.replace(/\.hbs$/, '');
          const content = await fs.readFile(
            join(partialsDir, entry.name),
            'utf8',
          );
          Handlebars.registerPartial(key, content);
        }
      }
    } catch {
      // no-op if partials dir missing
    }
    this.partialsRegistered = true;
  }

  async render(
    templateKey: string,
    context: Record<string, any>,
  ): Promise<{ html: string; subject?: string }> {
    await this.registerPartialsOnce();
    const { content: bodyTemplate } =
      await this.loader.loadTemplate(templateKey);
    const compiledBody = Handlebars.compile(bodyTemplate);
    const body = compiledBody(context ?? {});

    const layoutPath = join(
      process.cwd(),
      'apps',
      'notification-service',
      'src',
      'email',
      'templates',
      'layouts',
      'base.mjml.hbs',
    );
    const layoutSource = await fs.readFile(layoutPath, 'utf8');
    const compiledLayout = Handlebars.compile(layoutSource);
    const mjmlSource = compiledLayout({
      ...(context ?? {}),
      body,
      year: new Date().getFullYear(),
    });
    const { html, errors } = mjml2html(mjmlSource, { minify: true });
    if (errors && errors.length > 0) {
      const first = errors[0];
      throw new Error(
        `MJML render error: ${first.formattedMessage || first.message}`,
      );
    }
    const subject: string | undefined = context?.subject;
    return { html, subject };
  }
}
