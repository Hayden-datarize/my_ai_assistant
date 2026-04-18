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
        selector: "MemberExpression[property.name='outerHTML']",
        message: 'outerHTML is forbidden — use DOM APIs.',
      },
    ],
  },
  ignorePatterns: ['dist/', 'node_modules/', 'daily-growth.html'],
};
