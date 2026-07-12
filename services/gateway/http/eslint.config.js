import rootConfig from '../../../eslint.config.js';

export default [
  ...rootConfig,
  {
    ignores: ['**/tests/tambo_determinism.test.ts', '**/dist/**'],
  },
];
