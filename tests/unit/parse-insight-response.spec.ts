import { describe, it, expect } from 'vitest';
import { parseInsightResponse } from '../../src/utils/gemini-parse';

describe('parseInsightResponse (v3.25 T3)', () => {
  it('정상 응답 — text|interestId split', () => {
    const r = parseInsightResponse('통찰 한 문장|recruiting');
    expect(r.text).toBe('통찰 한 문장');
    expect(r.interestId).toBe('recruiting');
  });

  it('| 없음 — 전체 text + unknown', () => {
    const r = parseInsightResponse('통찰만 있는 응답');
    expect(r.text).toBe('통찰만 있는 응답');
    expect(r.interestId).toBe('unknown');
  });

  it('interestId invalid — unknown 폴백', () => {
    const r = parseInsightResponse('통찰|hallucinated');
    expect(r.text).toBe('통찰');
    expect(r.interestId).toBe('unknown');
  });

  it('text에 | 포함 — lastIndexOf 기준 split', () => {
    const r = parseInsightResponse('a|b|c|recruiting');
    expect(r.text).toBe('a|b|c');
    expect(r.interestId).toBe('recruiting');
  });

  it('markdown wrap (backtick) 제거', () => {
    const r = parseInsightResponse('`통찰|recruiting`');
    expect(r.text).toBe('통찰');
    expect(r.interestId).toBe('recruiting');
  });

  it('markdown wrap (asterisk) 제거', () => {
    const r = parseInsightResponse('**통찰|ai_ml**');
    expect(r.text).toBe('통찰');
    expect(r.interestId).toBe('ai_ml');
  });

  it('여러 줄 응답 — 첫 비빈 줄만 사용', () => {
    const r = parseInsightResponse('  \n\n통찰 한 줄|recruiting\n설명 추가 줄|onboarding\n');
    expect(r.text).toBe('통찰 한 줄');
    expect(r.interestId).toBe('recruiting');
  });

  it("'unknown' literal 허용", () => {
    const r = parseInsightResponse('애매한 통찰|unknown');
    expect(r.text).toBe('애매한 통찰');
    expect(r.interestId).toBe('unknown');
  });

  // Codex P1-B1 강화: JSON wrap / quote / prefix / label alias

  it('JSON wrap (raw {...}) — text/interestId 추출', () => {
    const r = parseInsightResponse('{"text":"통찰","interestId":"recruiting"}');
    expect(r.text).toBe('통찰');
    expect(r.interestId).toBe('recruiting');
  });

  it('JSON fenced (```json) — text/interestId 추출', () => {
    const r = parseInsightResponse('```json\n{"text":"통찰","interestId":"ai_ml"}\n```');
    expect(r.text).toBe('통찰');
    expect(r.interestId).toBe('ai_ml');
  });

  it('JSON에 interestId 누락 — unknown 폴백 + text 추출', () => {
    const r = parseInsightResponse('{"text":"통찰"}');
    expect(r.text).toBe('통찰');
    expect(r.interestId).toBe('unknown');
  });

  it('id quote wrap ("recruiting") — quote 제거 후 매칭', () => {
    const r = parseInsightResponse('통찰|"recruiting"');
    expect(r.interestId).toBe('recruiting');
  });

  it('id prefix label (interestId: recruiting) — prefix 제거 후 매칭', () => {
    const r = parseInsightResponse('통찰|interestId: recruiting');
    expect(r.interestId).toBe('recruiting');
  });

  it("id 한국어 prefix (분야: recruiting) — 제거 후 매칭", () => {
    const r = parseInsightResponse('통찰|분야: recruiting');
    expect(r.interestId).toBe('recruiting');
  });

  it("id 한국어 label (채용) — alias map으로 매칭", () => {
    const r = parseInsightResponse('통찰|채용');
    expect(r.interestId).toBe('recruiting');
  });

  it("id emoji label (🎯 채용) — alias map으로 매칭", () => {
    const r = parseInsightResponse('통찰|🎯 채용');
    expect(r.interestId).toBe('recruiting');
  });

  // T3 review C1 fix: VS-16 (variation selector U+FE0F) 포함 emoji prefix 매칭
  it("id 한국어 label (노무/법률, VS-16 포함 ⚖️ prefix) — alias 매칭 (C1 fix)", () => {
    const r = parseInsightResponse('통찰|노무/법률');
    expect(r.interestId).toBe('labor_law');
  });

  it("id emoji label (⚖️ 노무/법률) — VS-16 포함 raw prefix 매칭", () => {
    const r = parseInsightResponse('통찰|⚖️ 노무/법률');
    expect(r.interestId).toBe('labor_law');
  });
});

// T3 review I1 fix: catalog-driven parametrized 회귀 spec — INTERESTS 15개 전체 cover
import { INTERESTS } from '../../src/utils/categories';

describe('parseInsightResponse alias map — catalog 전체 회귀 (T3 review I1)', () => {
  it.each(INTERESTS)('$id label `$label` emoji prefix 제거 후 alias 매칭', ({ id, label }) => {
    const stripped = label.replace(/^[\p{Emoji}\p{Emoji_Component}\s]+/u, '');
    const r = parseInsightResponse(`통찰|${stripped}`);
    expect(r.interestId).toBe(id);
  });

  it.each(INTERESTS)('$id raw label `$label` (emoji prefix 포함) alias 매칭', ({ id, label }) => {
    const r = parseInsightResponse(`통찰|${label}`);
    expect(r.interestId).toBe(id);
  });
});
