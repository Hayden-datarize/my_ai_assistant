/**
 * v3.38 T1b (C9): 한국어 string literal NFC normalize 강제.
 *
 * NFD (Unicode decomposed) 형태로 한국어가 작성되면 NFC 정규화된 production
 * 데이터와 silent 매칭 fail. 본 rule은 한국어 음절 블록 또는 모던 자모 포함
 * string/template literal이 NFC normalize 아니면 error.
 *
 * 매칭 범위 (NFD catch를 위해 자모 영역도 포함):
 *  - U+AC00~U+D7A3 (한글 음절 블록 '가'~'힣')
 *  - U+1100~U+11FF (한글 자모 — NFD 분리 표현)
 *  - U+A960~U+A97F (한글 자모 확장-A)
 *  - U+D7B0~U+D7FF (한글 자모 확장-B)
 *
 * **False negative (v3.39+ carry)**:
 *  - 호환성 자모(U+3130~U+318F) 분리 형태 (예: 'ㄱ'+'ㅏ'+'ㄴ').
 *    Standard NFD 정규화는 호환성 자모로 분해하지 않으므로 production 영향 미미.
 *
 * ESM default export — `package.json` `"type": "module"` 환경 대응 (Codex 사전 P0-2).
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: '한국어 string literal은 NFC normalize 필수' },
    schema: [],
    messages: {
      nfd: '한국어 string literal이 NFC normalize 아님 — production 매칭 silent fail risk. .normalize("NFC") 적용 또는 literal 재타이핑.',
    },
  },
  create(context) {
    // 음절 블록(가-힣) + 자모(U+1100~U+11FF) + 자모 확장-A/B 영역.
    // NFD 분리 표현은 음절 블록에 속하지 않으므로 자모 영역도 명시적으로 포함.
    const KOREAN_RE = /[ᄀ-ᇿꥠ-꥿가-힣ힰ-퟿]/;
    function check(value, node) {
      if (typeof value !== 'string') return;
      if (!KOREAN_RE.test(value)) return;
      if (value !== value.normalize('NFC')) {
        context.report({ node, messageId: 'nfd' });
      }
    }
    return {
      Literal(node) {
        check(node.value, node);
      },
      TemplateElement(node) {
        check(node.value.cooked, node);
      },
    };
  },
};
