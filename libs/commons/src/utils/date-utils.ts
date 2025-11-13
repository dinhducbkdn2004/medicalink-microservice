import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
// Default all timezone operations to UTC
dayjs.tz.setDefault('UTC');

function normalizeTimeString(time: string): string {
  const match = time.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (!match) throw new Error('Invalid time format');
  const [, h, m, s = '0'] = match;
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
}

export function toUtcDate(input: string | Date): Date {
  return dayjs.utc(input).toDate();
}

export function combineDateWithTimeUtc(dateStr: string, timeStr: string): Date {
  const iso = `${dayjs.utc(dateStr || '1970-01-01').format('YYYY-MM-DD')}T${normalizeTimeString(timeStr)}`;
  const d = dayjs.utc(iso, 'YYYY-MM-DDTHH:mm:ss', true);
  if (!d.isValid()) throw new Error('Invalid time format');
  return d.toDate();
}

export function parseTimeToMinutesUtc(timeStr: string): number {
  const d = dayjs.utc(
    `1970-01-01T${normalizeTimeString(timeStr)}`,
    'YYYY-MM-DDTHH:mm:ss',
    true,
  );
  if (!d.isValid()) throw new Error('Invalid time format');
  return d.hour() * 60 + d.minute();
}

export function timeToUtc(timeStr: string): Date {
  const d = dayjs.utc(
    `1970-01-01T${normalizeTimeString(timeStr)}`,
    'YYYY-MM-DDTHH:mm:ss',
    true,
  );
  if (!d.isValid()) throw new Error('Invalid time format');
  return d.toDate();
}

export function extractTimeHHmm(input: string | Date): string {
  if (input instanceof Date) {
    return dayjs.utc(input).format('HH:mm');
  }
  if (typeof input === 'string') {
    const match = input.match(/(\d{1,2}):(\d{1,2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
    }
  }
  throw new Error('Invalid time format');
}

export function nowUtc(): Date {
  return dayjs.utc().toDate();
}

export function getUtcDayOfWeek(input: string | Date): number {
  return dayjs.utc(input).day();
}

export function ymdUtc(input: string | Date): string {
  return dayjs.utc(input).format('YYYY-MM-DD');
}

// Normalize a date input that may be a Date, ISO string, or 'YYYY-MM-DD' into a UTC Date
export function normalizeDateInputToUtcDate(
  input: unknown,
): Date | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (input instanceof Date) return input;
  if (typeof input === 'string' || typeof input === 'number') {
    const str = String(input);
    const iso = str.includes('T') ? str : `${str}T00:00:00.000Z`;
    const d = dayjs.utc(iso);
    return d.isValid() ? d.toDate() : undefined;
  }
  return undefined;
}

export { dayjs };
