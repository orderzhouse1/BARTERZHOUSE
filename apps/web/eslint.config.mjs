import { FlatCompat } from '@eslint/eslintrc';
import nextPlugin from '@next/eslint-plugin-next';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  resolvePluginsRelativeTo: import.meta.dirname,
});

const eslintConfig = [
  {
    ignores: ['.next/**', 'next-env.d.ts', 'vitest.config.ts'],
  },
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript'],
  }),
  {
    // Explicit registration so Next.js build-time detection finds `@next/next`.
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

export default eslintConfig;
