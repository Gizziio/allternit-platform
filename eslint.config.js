import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// React Compiler build artifacts committed as source under ink-app
// (see docs/programs/gizzi/INK_APP_COMPILER_ARTIFACTS.md). They are
// machine-generated and @ts-nocheck; linting them is noise. Detected by the
// same fingerprint the ts-nocheck burn-down uses.
const INK_APP_DIR = 'cmd/gizzi-code/src/cli/ui/ink-app';
function findCompilerArtifacts(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...findCompilerArtifacts(path));
    else if (path.endsWith('.tsx') && readFileSync(path, 'utf8').includes('react/compiler-runtime')) {
      out.push(path);
    }
  }
  return out;
}

export default tseslint.config(
  { ignores: ['**/dist', '**/node_modules', '**/*.js', '**/*.cjs', '**/*.mjs'] },
  { ignores: findCompilerArtifacts(INK_APP_DIR) },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      'no-undef': 'off',
      'prefer-const': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  }
);
