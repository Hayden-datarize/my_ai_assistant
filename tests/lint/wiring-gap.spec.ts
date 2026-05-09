import { describe, it, expect } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of entries) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

/**
 * 임시 allowlist — dispatcher가 다음 task에서 추가될 때까지 listener-only 허용.
 * v3.25 T6에서 `dg:insights:updated` dispatcher 추가됨 (insight-detail 모달 dropdown change).
 * 현재 비어 있음. 새 listener-only 이벤트 도입 시에만 임시 추가 (다음 task에서 제거 의무).
 */
const DISPATCHER_DEFERRED: readonly string[] = [] as const;

describe('wiring-gap', () => {
  it('every dispatched event name has a listener and every listener has a dispatcher', async () => {
    const srcFiles = await walk(resolve(ROOT, 'src'));
    const dispatched = new Set<string>();
    const listened = new Set<string>();
    // match: dispatch<K>(name, ...), dispatchEvent(new CustomEvent('dg:...'))
    const dispatchRe =
      /(?:dispatch\s*(?:<[^>]+>)?\s*\(\s*['"](dg:[\w:-]+)['"]|dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*['"](dg:[\w:-]+)['"])/g;
    // match: on<K>('dg:...', ...), addEventListener('dg:...', ...)
    const listenRe =
      /(?:\bon\s*(?:<[^>]+>)?\s*\(\s*['"](dg:[\w:-]+)['"]|addEventListener\s*\(\s*['"](dg:[\w:-]+)['"])/g;

    for (const f of srcFiles) {
      const src = await readFile(f, 'utf8');
      for (const m of src.matchAll(dispatchRe)) {
        const name = m[1] ?? m[2];
        if (name) dispatched.add(name);
      }
      for (const m of src.matchAll(listenRe)) {
        const name = m[1] ?? m[2];
        if (name) listened.add(name);
      }
    }

    const missingListener = [...dispatched].filter(n => !listened.has(n));
    const missingDispatcher = [...listened].filter(
      n => !dispatched.has(n) && !DISPATCHER_DEFERRED.includes(n),
    );
    expect(missingListener, 'events dispatched without listener').toEqual([]);
    expect(missingDispatcher, 'listeners for events never dispatched').toEqual([]);
  });

  it('every #id referenced by handlers is declared in tabs markup or index.html', async () => {
    const handlerFiles = await walk(resolve(ROOT, 'src/ui/handlers'));
    const tabFiles = await walk(resolve(ROOT, 'src/ui/tabs'));
    const onboardingFiles = await walk(resolve(ROOT, 'src/ui')).catch(() => [] as string[]);
    const declared = new Set<string>();

    // 1. <div id="foo"> in index.html
    const indexHtml = await readFile(resolve(ROOT, 'index.html'), 'utf8').catch(() => '');
    const htmlIdRe = /id\s*=\s*["']([A-Za-z][\w-]*)["']/g;
    for (const m of indexHtml.matchAll(htmlIdRe)) {
      if (m[1]) declared.add(m[1]);
    }

    // 2. element.id = '...' and <element id="..."> in tab + onboarding source
    const tsIdAssignRe = /\.id\s*=\s*['"]([A-Za-z][\w-]*)['"]/g;
    const tsIdAttrRe = /\bid\s*=\s*['"]([A-Za-z][\w-]*)['"]/g;
    for (const f of [...tabFiles, ...onboardingFiles]) {
      const src = await readFile(f, 'utf8');
      for (const m of src.matchAll(tsIdAssignRe)) if (m[1]) declared.add(m[1]);
      for (const m of src.matchAll(tsIdAttrRe)) if (m[1]) declared.add(m[1]);
    }

    // handler references: qs('#foo'), qs('foo'), getElementById('foo')
    const refRe = /(?:\bqs|\bqsa|getElementById)\s*\(\s*['"]#?([A-Za-z][\w-]*)['"]/g;
    const missingIds = new Set<string>();
    for (const f of handlerFiles) {
      const src = await readFile(f, 'utf8');
      for (const m of src.matchAll(refRe)) {
        if (m[1] && !declared.has(m[1])) missingIds.add(m[1]);
      }
    }
    expect([...missingIds], 'handler id refs missing from markup').toEqual([]);
  });
});
