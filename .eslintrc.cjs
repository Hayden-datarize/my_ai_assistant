module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parserOptions: { ecmaVersion: 2020, sourceType: 'module' },
  env: { browser: true, es2020: true, node: true },
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "MemberExpression[property.name='innerHTML']",
        message: 'innerHTML is forbidden — use textContent or render() helper. If HTML is required, escapeHtml all interpolations.',
      },
      {
        selector: "MemberExpression[computed=true][property.value='innerHTML']",
        message: "el['innerHTML'] is the same as el.innerHTML — forbidden for the same reason. Use textContent or escapeHtml.",
      },
      {
        selector: "MemberExpression[property.name='outerHTML']",
        message: 'outerHTML is forbidden — use DOM APIs (createElement, replaceWith). If HTML is required, escapeHtml all interpolations.',
      },
      {
        selector: "MemberExpression[computed=true][property.value='outerHTML']",
        message: "el['outerHTML'] is the same as el.outerHTML — forbidden for the same reason.",
      },
      {
        selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
        message: 'insertAdjacentHTML is a CSP-relevant XSS sink — use DOM APIs or escapeHtml.',
      },
    ],
    // Migration trade-off: tabs/services often need `any` shims while porting from
    // legacy untyped code. Re-tighten to 'error' once migration stabilizes (Task 22+).
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'daily-growth.html'],
};
