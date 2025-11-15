import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';

export class SafeValidationPipe extends ValidationPipe {
  async transform(value: any, metadata: ArgumentMetadata) {
    if (value && typeof value === 'object') {
      this.processObject(value);
    }

    return super.transform(value, metadata);
  }

  private processObject(obj: any): void {
    for (const key in obj) {
      if (obj[key] === null || obj[key] === undefined) {
        continue;
      }

      if (typeof obj[key] === 'string') {
        const trimmed = obj[key].trim();
        obj[key] = trimmed;

        if (this.containsDangerousContent(trimmed)) {
          throw new BadRequestException(
            `Validation failed: Field '${key}' contains potentially dangerous content`,
          );
        }
      } else if (typeof obj[key] === 'object') {
        this.processObject(obj[key]);
      }
    }
  }

  private containsDangerousContent(value: string): boolean {
    if (!value) return false;

    // XSS patterns
    const xssPattern =
      /<script|<iframe|javascript:|onerror\s*=|onload\s*=|<img|<svg|<object|<embed|<link|<style|onclick\s*=|onmouseover\s*=/i;

    // SQL Injection patterns
    const sqlPattern =
      /(\bDROP\s+TABLE\b|\bDELETE\s+FROM\b|\bINSERT\s+INTO\b|\bUPDATE\s+SET\b|\bSELECT\s+.*\s+FROM\b|\bUNION\s+SELECT\b|\bEXEC\b|\bEXECUTE\b|;\s*DROP\b|;\s*DELETE\b|--\s*$|\/\*|\*\/)/i;

    return xssPattern.test(value) || sqlPattern.test(value);
  }
}
