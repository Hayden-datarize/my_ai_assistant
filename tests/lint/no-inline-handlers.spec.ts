import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIRS = ['src', 'index.html'];

const INLINE_HANDLER_RE = /\son[a-z]+\s*=\s*["']/i;
const JAVASCRIPT_URL_RE = /\bjavascript:/i;

function* walk(dir: string): Generator<string> {
  const full = join(ROOT, dir);
  const stats = statSync(full);
  if (stats.isFile()) {
    yield full;
    return;
  }
  for (const entry of readdirSync(full)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    yield* walk(join(dir, entry));
  }
}

describe('CSP lint gate (P5-X2)', () => {
  it('contains zero inline event handlers in source', () => {
    const offenders: string[] = [];
    for (const target of SCAN_DIRS) {
      for (const file of walk(target)) {
        if (!/\.(html|ts|tsx|js)$/.test(file)) continue;
        const text = readFileSync(file, 'utf8');
        if (INLINE_HANDLER_RE.test(text)) offenders.push(`${file}: inline on*= handler`);
        if (JAVASCRIPT_URL_RE.test(text)) offenders.push(`${file}: javascript: URL`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
