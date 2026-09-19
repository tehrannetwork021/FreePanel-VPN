import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const nodeGlobals = Object.fromEntries(
  [
    'process',
    'console',
    'URL',
    'TextEncoder',
    'TextDecoder',
    'WebSocket',
    'fetch',
    'setTimeout',
    'clearTimeout',
  ].map((name) => [name, 'readonly']),
);

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/.superpowers/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['deploy/worker/test/**/*.mjs'],
    languageOptions: { globals: nodeGlobals },
  },
);
