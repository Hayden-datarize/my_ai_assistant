import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const stylesDir = join(here, '..', '..', 'src', 'styles');
// v3.3.0: tokens moved to tokens.css (@layer tokens); layout consumers moved to layout.css (@layer layout).
const tokensCss = readFileSync(join(stylesDir, 'tokens.css'), 'utf-8');
const layoutCss = readFileSync(join(stylesDir, 'layout.css'), 'utf-8');
const formsCss = readFileSync(join(stylesDir, 'components', 'forms.css'), 'utf-8');
const baseCss = readFileSync(join(stylesDir, 'base.css'), 'utf-8');

describe('css drift guards (v3.2b-polish)', () => {
  it('--sidebar-width defined in :root with 240px', () => {
    expect(tokensCss).toMatch(/:root\s*\{[\s\S]*?--sidebar-width:\s*240px/);
  });
  // Re-enabled in Task 5: drawer CSS consumes --sidebar-width.
  it('--sidebar-width used at least once (drawer in v3.3.1+)', () => {
    const matches = layoutCss.match(/var\(--sidebar-width\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

describe('layout.css dead code removal (v3.3.1)', () => {
  it('no .app-container declarations remain', () => {
    expect(layoutCss).not.toMatch(/\.app-container\s*\{/);
  });
});

describe('sidebar drawer CSS (v3.3.1)', () => {
  it('sidebar drawer styles exist in layout.css', () => {
    expect(layoutCss).toMatch(/\.sidebar-drawer\s*\{/);
    expect(layoutCss).toMatch(/\.sidebar-backdrop\s*\{/);
    expect(layoutCss).toMatch(/\.sidebar-toggle\s*\{/);
    expect(layoutCss).toMatch(/transform:\s*translateX\(-100%\)/);
  });
});

describe('settings layout (v3.3.1)', () => {
  it('.settings-section has max-width 560px and centered margin', () => {
    expect(formsCss).toMatch(/\.settings-section\s*\{[^}]*max-width:\s*560px/);
    expect(formsCss).toMatch(/\.settings-section\s*\{[^}]*margin:\s*0\s+auto/);
  });
});

describe('font-size token rename (v3.3.1, resolves v3.3.0 open P1-A)', () => {
  it('font-size tokens use --font-size-* naming (not --text-*)', () => {
    expect(tokensCss).toMatch(/--font-size-base:\s*16px/);
    expect(tokensCss).not.toMatch(/--text-base:\s*16px/);
  });
  it('color tokens preserve --text-primary/secondary/tertiary', () => {
    expect(tokensCss).toMatch(/--text-primary:\s*#[0-9A-F]{6}/i);
    expect(tokensCss).toMatch(/--text-secondary:\s*#[0-9A-F]{6}/i);
    expect(tokensCss).toMatch(/--text-tertiary:\s*#[0-9A-F]{6}/i);
  });
});

describe('v3.3.3 z-index tokens', () => {
  let css: string;
  beforeAll(() => {
    css = readFileSync('src/styles/tokens.css', 'utf8');
  });

  // tokens.css에는 :root 블록이 여러 개 있어, 모두 합쳐서 탐색한다.
  const collectRoot = (src: string): string => {
    const blocks = src.match(/:root\s*\{[\s\S]*?\}/g) ?? [];
    return blocks.join('\n');
  };

  it('defines z layers with monotone ordering in :root', () => {
    // :root 블록에서 값 추출 — regex는 단순/견고하게
    const rootBlock = collectRoot(css);
    const get = (name: string): number => {
      const m = rootBlock.match(new RegExp(`--${name}:\\s*(\\d+)`));
      return m ? parseInt(m[1]!, 10) : NaN;
    };
    expect(get('z-sidebar')).toBe(40);
    expect(get('z-sidebar-button')).toBe(41);
    expect(get('z-floating')).toBe(100);
    expect(get('z-onboarding')).toBe(900);
    expect(get('z-splash')).toBe(1000);
    expect(get('z-modal')).toBe(1100);
    expect(get('z-toast')).toBe(2000);
  });

  it('toast > modal > splash > onboarding > floating > sidebar (monotone)', () => {
    const rootBlock = collectRoot(css);
    const get = (name: string): number => parseInt(rootBlock.match(new RegExp(`--${name}:\\s*(\\d+)`))?.[1] ?? '0', 10);
    const values = [
      get('z-sidebar'),
      get('z-floating'),
      get('z-onboarding'),
      get('z-splash'),
      get('z-modal'),
      get('z-toast'),
    ];
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]!);
    }
  });
});

describe('v3.3.3 modal backdrop token', () => {
  let css: string;
  beforeAll(() => {
    css = readFileSync('src/styles/tokens.css', 'utf8');
  });

  it('defines --modal-backdrop in :root (light)', () => {
    // Concatenate all :root blocks
    const roots = css.match(/:root\s*\{[^}]*\}/g)?.join('\n') ?? '';
    expect(roots).toMatch(/--modal-backdrop:\s*rgba\(0,\s*0,\s*0,\s*0\.4\)/);
  });

  it('overrides --modal-backdrop in [data-theme="dark"]', () => {
    const dark = css.match(/\[data-theme="dark"\]\s*\{[^}]*\}/s)?.[0] ?? '';
    expect(dark).toMatch(/--modal-backdrop:\s*rgba\(0,\s*0,\s*0,\s*0\.6\)/);
  });
});

describe('v3.17 tokens — color / shadow / radius / motion', () => {
  it('does not define --primary-vivid (G1-1, dead since v3.17 T1)', () => {
    expect(tokensCss).not.toMatch(/--primary-vivid:/);
  });

  it('does not define --primary-gradient (G1-2, dead since v3.3.0 baseline)', () => {
    expect(tokensCss).not.toMatch(/--primary-gradient:/);
  });

  it('does not define --accent-gradient (G1-3, dead since v3.3.0 baseline)', () => {
    expect(tokensCss).not.toMatch(/--accent-gradient:/);
  });

  it('exposes --shadow-glow focus ring', () => {
    expect(tokensCss).toMatch(/--shadow-glow:\s*0 0 0 4px rgba\(99,\s*102,\s*241,\s*0\.15\)/);
  });

  it('exposes --radius-2xl: 24px', () => {
    expect(tokensCss).toMatch(/--radius-2xl:\s*24px/);
  });

  it('exposes --ease-spring cubic-bezier(0.34,1.56,0.64,1)', () => {
    expect(tokensCss).toMatch(/--ease-spring:\s*cubic-bezier\(0\.34,\s*1\.56,\s*0\.64,\s*1\)/);
  });

  it('exposes --ease-out-soft cubic-bezier(0.22,1,0.36,1)', () => {
    expect(tokensCss).toMatch(/--ease-out-soft:\s*cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/);
  });

  it('--shadow-md is multi-layer (3D depth)', () => {
    // Two rgba layers comma-separated indicates 3D depth treatment.
    expect(tokensCss).toMatch(/--shadow-md:[^;]*rgba[^;]*,[^;]*rgba/);
  });
});

describe('v3.17 T2 — dark warm charcoal', () => {
  it('--bg dark = #161823 (warm charcoal, was slate-900 #0F172A)', () => {
    expect(tokensCss).toMatch(/\[data-theme="dark"\][\s\S]*?--bg:\s*#161823/);
  });

  // v3.18 T3 (G2-2): dark --bg-card lifted from #22242F to #2A2D3A
  // (luminance 0.018 → 0.027, ratio 1.14:1 → 1.29:1, target >=1.25, 카드 boundary 인지 회복)
  // T0 review P0-1 정정: 이전 plan ratio 1.82→2.45 주장은 산술 오류. 재계산 후 정정.
  it('--bg-card dark = #2A2D3A (lifted for visual hierarchy vs --bg)', () => {
    expect(tokensCss).toMatch(/\[data-theme="dark"\][\s\S]*?--bg-card:\s*#2A2D3A/);
  });

  it('dark --bg-card luminance ratio vs --bg ≥ 1.25:1 (visual hierarchy lift, T0 review P0-1 정정)', () => {
    // Pure CSS regex assertion — light values
    const darkBlock = tokensCss.match(/\[data-theme="dark"\]\s*\{([^}]*)\}/)?.[1] ?? '';
    const bgCardMatch = darkBlock.match(/--bg-card:\s*(#[0-9A-Fa-f]+)/);
    const bgMatch = darkBlock.match(/--bg:\s*(#[0-9A-Fa-f]+)/);
    expect(bgCardMatch).not.toBeNull();
    expect(bgMatch).not.toBeNull();
    // Hex → relative luminance (sRGB; gamma 단순화 — visual hierarchy 검증 목적)
    const lum = (hex: string): number => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const linearize = (c: number): number => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
    };
    const ratio = (lum(bgCardMatch![1]!) + 0.05) / (lum(bgMatch![1]!) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(1.25);
  });

  it('--bg-input dark = #363846', () => {
    expect(tokensCss).toMatch(/\[data-theme="dark"\][\s\S]*?--bg-input:\s*#363846/);
  });

  it('--border dark = #4B4D5A (lifted from #363846 to break collapse with --bg-input)', () => {
    expect(tokensCss).toMatch(/\[data-theme="dark"\][\s\S]*?--border:\s*#4B4D5A/);
  });

  it('--heatmap-l0 dark synced to --bg #161823', () => {
    // The heatmap dark block has its own [data-theme="dark"] selector — ensure --heatmap-l0 matches new --bg.
    // Find the [data-theme="dark"] block that actually contains --heatmap-l0 (the second one).
    const darkBlocks = [...tokensCss.matchAll(/\[data-theme="dark"\]\s*\{([\s\S]*?)\}/g)];
    const heatmapBlock = darkBlocks.find((m) => /--heatmap-l0:/.test(m[1] ?? ''));
    const value = heatmapBlock?.[1]?.match(/--heatmap-l0:\s*(#[0-9A-Fa-f]+)/)?.[1];
    expect(value?.toLowerCase()).toBe('#161823');
  });
});

describe('v3.17 T6 — scroll-margin CSS UX (carry-B)', () => {
  it('input/textarea/data-scroll-target 전역 selector에 scroll-margin-top', () => {
    // v3.40 T6: selector 확장 — archive/insight/plant/mission/garden 카드 추가.
    expect(baseCss).toMatch(/:where\(input,\s*textarea,\s*\[data-scroll-target\]/);
    expect(baseCss).toMatch(/scroll-margin-top:\s*calc\(var\(--nav-height\)\s*\+\s*16px\)/);
  });

  it('scroll-margin-bottom uses --content-bottom-pad', () => {
    expect(baseCss).toMatch(/scroll-margin-bottom:\s*var\(--content-bottom-pad\)/);
  });

  // v3.40 T6 신규: archive/insight/plant/mission/garden 카드 selector 회귀 가드
  it('v3.40 T6: archive/insight/plant/mission/garden 카드 selector 포함', () => {
    expect(baseCss).toMatch(/\.archive-card,\s*\.archive-insight-card/);
    expect(baseCss).toMatch(/\.plant-action-chip,\s*\.plant-action-home-chip,\s*\.insight-archive-nav-chip/);
    expect(baseCss).toMatch(/\.mission-card,\s*\.garden-card/);
  });
});
