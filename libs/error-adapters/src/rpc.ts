/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { RpcException } from '@nestjs/microservices';
import { HttpException } from '@nestjs/common';
import { DomainError } from '@app/domain-errors';

export type RpcErrorPayload = {
  statusCode: number;
  message: string;
  error: string;
  details?: unknown;
};

export function toRpcException(e: unknown): RpcException {
  if (e instanceof RpcException) return e;

  let p: RpcErrorPayload;

  // Handle SagaOrchestrationError specifically
  if (isSagaOrchestrationError(e)) {
    const sagaError = e as any;
    const originalError = sagaError.details;

    const statusCode =
      originalError?.statusCode ||
      (originalError?.error?.statusCode ? originalError.error.statusCode : 500);

    const rootMessage =
      originalError?.message ||
      originalError?.error?.message ||
      sagaError.message ||
      'Saga orchestration failed';

    const name =
      originalError?.name ||
      originalError?.error?.name ||
      'Saga Orchestration Failed';

    p = {
      statusCode,
      error: name,
      message: rootMessage,
      details: {
        sagaError: sagaError.message,
        sagaId: sagaError.sagaId,
        step: sagaError.step,
        executedSteps: sagaError.executedSteps,
        compensatedSteps: sagaError.compensatedSteps,
        durationMs: sagaError.durationMs,
      },
    };
  } else if (e instanceof HttpException) {
    // Handle all NestJS HTTP exceptions (including ValidationPipe errors)
    const status = e.getStatus();
    const response = e.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : (response as any)?.message || e.message;
    const details = typeof response === 'object' ? response : undefined;
    p = payload(status, e.name, message, details);
  } else if (isPrismaError(e)) {
    const parsed = parsePrismaError(e);
    const status =
      parsed.kind === 'known'
        ? parsed.code === 'P2025'
          ? 404
          : parsed.code === 'P2002' ||
              parsed.code === 'P2003' ||
              parsed.code === 'P2000'
            ? 409
            : 400
        : parsed.kind === 'validation'
          ? 400
          : parsed.kind === 'init' || parsed.kind === 'panic'
            ? 503
            : 500;

    p = payload(
      status,
      parsed.code ??
        (parsed.kind === 'validation' ? 'ValidationError' : 'DatabaseError'),
      parsed.message,
      {
        engine: 'PRISMA',
        kind: parsed.kind,
        code: parsed.code,
        ...(parsed.meta ? { meta: parsed.meta } : {}),
        raw: safeFirstLine((e as any)?.message),
      },
    );
  } else if (e instanceof DomainError) {
    const statusCode = e.statusCode ?? 400;
    const name = e.name;
    p = payload(statusCode, name, e.message, e.details);
  } else if (typeof (e as any).error === 'object') {
    const wrappedError = e as any;
    p = payload(
      wrappedError.error.statusCode,
      wrappedError.error.name,
      wrappedError.error.message,
    );
  } else {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    const details = (e as any)?.details;
    p = payload(500, 'Internal Server Error', msg, details);
  }

  return new RpcException(p);
}

function payload(
  statusCode: number,
  error: string,
  message: string,
  details?: unknown,
): RpcErrorPayload {
  return {
    statusCode,
    error,
    message: safeMessage(message),
    ...(details !== undefined && { details: safeDetails(details) }),
  };
}

function safeDetails(x: unknown): unknown {
  try {
    if (x === undefined) return undefined;
    JSON.stringify(x);
    return x;
  } catch {
    return { note: 'details omitted (not serializable)' };
  }
}

function safeMessage(m: unknown): string {
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.join('; ');
  try {
    return JSON.stringify(m);
  } catch {
    return 'Error';
  }
}

/* ================== PRISMA ERROR PARSING ================== */

function isPrismaError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err: any = e;

  const codeLooksPrisma =
    typeof err.code === 'string' && /^P\d{4}$/.test(err.code);
  const msg = typeof err.message === 'string' ? err.message : '';
  const name = typeof err.name === 'string' ? err.name : '';

  const prismaNameHit =
    /PrismaClient/.test(name) ||
    /PrismaClient/.test(msg) ||
    /PrismaClientValidationError/.test(msg) ||
    /PrismaClientKnownRequestError/.test(msg) ||
    /PrismaClientInitializationError/.test(msg) ||
    /PrismaClientRustPanicError/.test(msg);

  return codeLooksPrisma || prismaNameHit || /\binvocation\b/.test(msg);
}

type ParsedPrismaError = {
  kind: 'known' | 'validation' | 'init' | 'panic' | 'unknown';
  code?: string;
  message: string;
  meta?: Record<string, any>;
};

function parsePrismaError(e: unknown): ParsedPrismaError {
  const fallback: ParsedPrismaError = {
    kind: 'unknown',
    message: 'Database error',
  };
  if (!e || typeof e !== 'object') return fallback;

  const err: any = e;
  const code =
    typeof err.code === 'string' && /^P\d{4}$/.test(err.code)
      ? err.code
      : undefined;
  const rawMsg = String(err.message ?? '');
  const normalized = rawMsg.replace(/\r/g, '');
  const name = String(err.name ?? '');

  let kind: ParsedPrismaError['kind'] = 'unknown';
  if (code) kind = 'known';
  else if (
    /ValidationError/i.test(name) ||
    /PrismaClientValidationError/.test(rawMsg)
  )
    kind = 'validation';
  else if (
    /InitializationError/i.test(name) ||
    /PrismaClientInitializationError/.test(rawMsg)
  )
    kind = 'init';
  else if (
    /RustPanicError/i.test(name) ||
    /PrismaClientRustPanicError/.test(rawMsg)
  )
    kind = 'panic';

  if (kind === 'known') {
    const meta =
      err.meta && typeof err.meta === 'object'
        ? (err.meta as Record<string, any>)
        : undefined;

    switch (code) {
      case 'P2002': {
        // Unique constraint
        const target =
          arrayish(meta?.target) ??
          safeExtractFieldList(normalized)
            ?.split(',')
            .map((s) => s.trim());
        const fieldList = target?.length ? target.join(', ') : undefined;
        return {
          kind,
          code,
          meta: { ...meta, ...(target ? { target } : {}) },
          message: fieldList
            ? `Unique constraint failed on: ${fieldList}`
            : 'Unique constraint failed',
        };
      }
      case 'P2025': {
        // Record not found
        const cause = meta?.cause as string | undefined;
        const model = (meta as any)?.modelName as string | undefined;
        return {
          kind,
          code,
          meta: { ...meta, cause, model },
          message: cause ?? (model ? `${model} not found` : 'Record not found'),
        };
      }
      case 'P2003': {
        // FK violated
        const field =
          (meta as any)?.field_name ||
          (meta as any)?.field ||
          safeExtractConstraintName(normalized);
        return {
          kind,
          code,
          meta: { ...meta, field },
          message: field
            ? `Foreign key constraint violated on: ${field}`
            : 'Foreign key constraint violated',
        };
      }
      case 'P2000': {
        // Value too long
        const column = (meta as any)?.column_name || (meta as any)?.column;
        const length = (meta as any)?.length;
        return {
          kind,
          code,
          meta: { ...meta, column, length },
          message: column
            ? `Value too long for column '${column}'${length ? ` (max ${length})` : ''}`
            : 'Value too long for column',
        };
      }
      default: {
        return {
          kind,
          code,
          meta: meta ?? undefined,
          message: firstMeaningfulLine(normalized) ?? `Prisma error ${code}`,
        };
      }
    }
  }

  if (kind === 'validation') {
    const mUnknownArg = normalized.match(/Unknown argument\s+`(\w+)`/i);
    if (mUnknownArg) {
      const hint = captureDidYouMean(normalized);
      return {
        kind,
        message: `Unknown argument '${mUnknownArg[1]}'${hint ? `. ${hint}` : ''}`,
        meta: { argument: mUnknownArg[1], hint },
      };
    }

    const mInvalidArg = normalized.match(
      /Argument\s+`(\w+)`\s*:\s*([^.\n]+(?:\.[^.\n]+)?)/i,
    );
    if (mInvalidArg) {
      return {
        kind,
        message: `Invalid ${mInvalidArg[1]}: ${trimDot(mInvalidArg[2])}`,
        meta: { argument: mInvalidArg[1] },
      };
    }

    const mInvalidSel = normalized.match(
      /Invalid value for selection field\s+`([^`]+)`\s*:\s*([^\n]+)/i,
    );
    if (mInvalidSel) {
      return {
        kind,
        message: `Invalid selection '${mInvalidSel[1]}': ${trimDot(mInvalidSel[2])}`,
        meta: { field: mInvalidSel[1] },
      };
    }

    const mSelect = normalized.match(
      /The\s+`?select`?\s+statement.*?(must not be empty|needs.*?truthy.*?value)/i,
    );
    if (mSelect) {
      return { kind, message: `Invalid select: ${capitalize(mSelect[1])}` };
    }
    const mIncludeScalar = normalized.match(
      /include.*only accept relation fields|IncludeOnScalar/i,
    );
    if (mIncludeScalar) {
      return {
        kind,
        message: 'Invalid include: only relation fields can be included',
      };
    }

    const mUnique = normalized.match(
      /Unique constraint failed on the fields?:\s*`?([^`]+)`?/i,
    );
    if (mUnique) {
      return {
        kind,
        message: `Unique constraint failed on: ${mUnique[1]}`,
        meta: { target: mUnique[1] },
      };
    }
    const mFk = normalized.match(
      /Foreign key constraint violated on the constraint:\s*`([^`]+)`/i,
    );
    if (mFk) {
      return {
        kind,
        message: `Foreign key constraint violated: ${mFk[1]}`,
        meta: { constraint: mFk[1] },
      };
    }

    return {
      kind,
      message: firstMeaningfulLine(normalized) ?? 'Invalid Prisma input',
    };
  }

  // init / panic
  if (kind === 'init') {
    return {
      kind,
      message:
        firstMeaningfulLine(normalized) ?? 'Database initialization error',
    };
  }
  if (kind === 'panic') {
    return { kind, message: 'Database engine panic' };
  }

  // Fallback
  return {
    kind: 'unknown',
    code,
    message: firstMeaningfulLine(normalized) ?? 'Database error',
  };
}

function isSagaOrchestrationError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  return (
    (e as any).sagaId !== undefined && (e as any).executedSteps !== undefined
  );
}

function firstMeaningfulLine(s: string): string | undefined {
  return s
    .split('\n')
    .map((x) => x.trim())
    .filter(
      (x) =>
        x &&
        !x.startsWith('at ') &&
        !x.includes('Object.create()') &&
        !x.includes('invocation in') &&
        !x.includes('node_modules') &&
        !x.includes('dist/'),
    )[0];
}
function safeFirstLine(s?: string): string | undefined {
  if (!s) return undefined;
  return s.split('\n')[0]?.trim();
}

function captureDidYouMean(s: string): string | undefined {
  const m = s.match(/Did you mean\s+`([^`]+)`\??/i);
  return m ? `Did you mean \`${m[1]}\`?` : undefined;
}

function trimDot(s: string): string {
  return s.replace(/\.\s*$/, '');
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function arrayish(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return [v];
  return undefined;
}

function safeExtractFieldList(raw: string): string | undefined {
  const m = raw.match(/fields?:\s*\(([^)]+)\)/i);
  if (m) return m[1].replace(/[`'"]/g, '').trim();
  const m2 = raw.match(/fields?:\s*`?([^`]+)`?/i);
  return m2 ? m2[1].replace(/[`'"]/g, '').trim() : undefined;
}

function safeExtractConstraintName(raw: string): string | undefined {
  const m = raw.match(/constraint:\s*`([^`]+)`/i);
  return m ? m[1] : undefined;
}
