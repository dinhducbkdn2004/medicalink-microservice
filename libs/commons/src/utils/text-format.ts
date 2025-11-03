/**
 * Shortens the given text to the specified maximum length.
 *
 * @param text       The original text to shorten.
 * @param maxLength  The maximum allowed length for the shortened text.
 * @param keepWord   If true, the function will attempt to cut at the last space
 *                   before the maxLength to avoid breaking words (default: true).
 *                   If false, the text is simply sliced at the exact maxLength.
 * @returns          The shortened text, trimmed of leading/trailing whitespace.
 */
export const shortenText = (
  text: string,
  maxLength: number,
  options?: { keepWord?: boolean; ellipsis?: boolean },
): string => {
  const { keepWord = true, ellipsis = true } = options || {};
  if (text.length <= maxLength) return text;
  if (!keepWord) {
    return text.slice(0, maxLength).trim() + (ellipsis ? '...' : '');
  }

  let truncated = text.slice(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  if (lastSpaceIndex > 0) {
    truncated = truncated.slice(0, lastSpaceIndex);
  }

  return truncated.trim() + (ellipsis ? '...' : '');
};

export const removeSymbols = (text?: string) => {
  if (!text) return '';
  return text.replace(/[^\w\s]/g, '');
};

export const removeHtmlTags = (text?: string) => {
  if (!text) return '';
  return text
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&[a-zA-Z0-9#]{1,20};/g, '');
};

export const getInitials = (
  name: string,
  maxLength: number = 2,
  joinChar: string = '',
) => {
  const words = removeSymbols(name).split(' ');
  const initials = words.map((word) => word[0]).join(joinChar);
  return initials.slice(0, maxLength);
};

export const commaSeparatedStringToArray = (
  value: any,
): string[] | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  return typeof value === 'string'
    ? value
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : value;
};
