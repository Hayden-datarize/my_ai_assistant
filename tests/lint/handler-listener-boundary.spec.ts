import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('handler listener boundary (v3.31 C7)', () => {
  it('listener modules do not static-import heavy handler modules', () => {
    for (const file of [
      'src/ui/handlers/archive-listeners.ts',
      'src/ui/handlers/stats-listeners.ts',
      'src/ui/handlers/missions-listeners.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      // v3.50 T1 (C3): missions-listeners는 handlers/missions.ts 폐기 후
      // home.hydrateMissions를 dynamic-import. home도 listener에서 static-import 금지.
      expect(source).not.toMatch(/from ['"]\.\/(archive|stats|missions|home)['"]/);
      expect(source).toMatch(/import\(['"]\.\/(archive|stats|missions|home)['"]\)/);
    }
  });

  it('main boot does not directly import non-home heavy handlers', () => {
    const source = readFileSync('src/main.ts', 'utf8');
    expect(source).toMatch(/import\(['"]\.\/ui\/handlers\/home['"]\)/);
    expect(source).not.toMatch(/import\(['"]\.\/ui\/handlers\/archive['"]\)/);
    expect(source).not.toMatch(/import\(['"]\.\/ui\/handlers\/stats['"]\)/);
    expect(source).not.toMatch(/import\(['"]\.\/ui\/handlers\/missions['"]\)/);
  });
});
