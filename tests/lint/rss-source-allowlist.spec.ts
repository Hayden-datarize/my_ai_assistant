import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * RSS source allowlist for the home tab "오늘의 브리핑" feature.
 *
 * brunch.co.kr/rss/* and wanted.co.kr/events/tech/rss were removed in
 * v3.2a-hotfix3 (2026-04-20) after rss2json began returning 422/500 for
 * every brunch path and 500 for the wanted path. This lint blocks
 * accidental re-introduction of the same dead URLs and prevents drift
 * between the interestToFeeds map and the verified-working source list.
 *
 * v3.11 T3 (2026-04-28): map became 1:N (interestToFeeds) and source pool
 * expanded from 6 to 15 unique feeds (KR 8 + EN 7) per spec §4.4.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const HOME_TS = readFileSync(resolve(ROOT, 'src/ui/handlers/home.ts'), 'utf8');

const KNOWN_BAD_PATTERNS = [
  /brunch\.co\.kr\/rss\//,
  /wanted\.co\.kr\/events\/tech\/rss/,
];

// Sources confirmed working against rss2json. Any URL added to
// interestToFeeds must be in this allowlist (after manual curl check).
// 2026-04-20: original 6 KR hosts.
// 2026-04-28 (v3.11 T3): expanded to 15 unique feeds (KR 8 + EN 7).
const ALLOWED_HOSTS = new Set([
  // KR
  'medium.com',
  'outstanding.kr',
  'toss.tech',
  'tech.kakao.com',
  'd2.naver.com',
  'www.mobiinside.co.kr',
  // v3.40 hotfix H1: lifehacker.co.kr SSL 만료 제거 (v3.42 T1: allowlist 동반 정리).
  'news.hada.io',
  'techblog.woowahan.com',
  'engineering.linecorp.com',
  // EN (v3.11 T3)
  'www.lennysnewsletter.com',
  'blog.pragmaticengineer.com',
  'www.mckinsey.com',
  'blog.bytebytego.com',
  'openai.com',
  'techcrunch.com',
  'martinfowler.com',
]);

function extractInterestMap(src: string): string[] {
  // Grab the body of the `interestToFeeds` map literal and pull every quoted URL.
  const mapMatch = src.match(/function interestToFeeds[\s\S]*?const map[^{]*\{([\s\S]*?)\};/);
  if (!mapMatch) throw new Error('interestToFeeds map literal not found in src/ui/handlers/home.ts');
  const body = mapMatch[1] ?? '';
  const urls = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  return urls;
}

describe('RSS source allowlist (home.ts interestToFeeds)', () => {
  const urls = extractInterestMap(HOME_TS);

  it('contains at least one URL', () => {
    expect(urls.length).toBeGreaterThan(0);
  });

  it.each(KNOWN_BAD_PATTERNS.map((p) => [p.source, p]))(
    'must not re-introduce known-bad pattern %s',
    (_label, pattern) => {
      const offenders = urls.filter((u) => pattern.test(u));
      expect(
        offenders,
        `interestToFeeds re-introduced dead RSS source(s): ${offenders.join(', ')}`,
      ).toEqual([]);
    },
  );

  it('every URL host is on the verified allowlist', () => {
    const offenders = urls.filter((u) => {
      try {
        return !ALLOWED_HOSTS.has(new URL(u).hostname);
      } catch {
        return true;
      }
    });
    expect(
      offenders,
      `interestToFeeds has URLs whose hostnames are not on the verified allowlist: ${offenders.join(', ')}\nAdd them to ALLOWED_HOSTS only after a manual curl rss2json check.`,
    ).toEqual([]);
  });
});
