/**
 * Validates that a value is an https:// URL parseable by `new URL()`.
 * - Rejects all non-string types (null/undefined/number/object).
 * - Rejects http://, javascript:, data:, and other schemes.
 * - Protocol comparison is case-insensitive (URL parser auto-lowercases).
 * - Whitespace is NOT auto-trimmed; callers responsible for normalization.
 */
export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  // Reject strings with leading/trailing whitespace — callers must normalize first
  if (value !== value.trim()) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
