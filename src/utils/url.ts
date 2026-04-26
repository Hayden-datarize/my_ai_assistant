/**
 * Validates that a value is an https:// URL parseable by `new URL()`.
 *
 * - Rejects all non-string types (null/undefined/number/object).
 * - Rejects non-https schemes (http, javascript, data, etc.).
 * - Rejects bare-path scheme variants (`https:foo`, `https:\\evil.com`,
 *   `HTTPS:foo`). Strict literal `https://` prefix required (case-insensitive).
 * - Rejects URLs with empty hostname (`https://`, `https:///path`).
 *   Note: the WHATWG URL parser misreads `https:///path` as hostname="path",
 *   so we also check the raw authority section from the string directly.
 * - Strings with leading/trailing whitespace are rejected; callers must trim
 *   first. This is intentional and not an error signal — caller가 trim 책임.
 * - case-insensitive prefix 보존 의도 — `HTTPS://example.com` 입력은 통과
 *   (URL parser가 protocol을 lowercase로 정규화).
 *
 * 정책 분리: host policy(IP literal/localhost reject 등)는 본 함수가 아닌
 * 별도 `isAllowedImageHost` 류로 분기. 본 함수는 프로토콜 검사 only.
 */
const HTTPS_PREFIX = /^https:\/\//i;

/**
 * Extracts the raw authority (host[:port]) from after `https://`.
 * Precondition: value must already have passed `HTTPS_PREFIX` test (contains `//`).
 * Standalone use without that guard would silently strip a leading character
 * when `indexOf('//')` returns -1.
 */
function extractRawAuthority(value: string): string {
  const afterSlashes = value.slice(value.indexOf('//') + 2);
  const end = afterSlashes.search(/[/?#]/);
  return end === -1 ? afterSlashes : afterSlashes.slice(0, end);
}

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value !== value.trim()) return false;
  if (!HTTPS_PREFIX.test(value)) return false;
  // Defense-in-depth: reject empty authority (e.g. 'https:///path' which the
  // WHATWG URL parser incorrectly resolves with a non-empty hostname).
  if (extractRawAuthority(value).length === 0) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname.length > 0;
  } catch {
    return false;
  }
}
