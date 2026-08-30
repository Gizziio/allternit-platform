import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export default defineConfig({
  plugins: [
    {
      name: 'resolve-ts-js',
      enforce: 'pre',
      resolveId(source, importer) {
        if (
          importer &&
          source.endsWith('.js') &&
          !source.includes('node_modules')
        ) {
          const tsSource = source.replace(/\.js$/, '.ts');
          const resolved = resolve(dirname(importer), tsSource);
          if (existsSync(resolved)) {
            return resolved;
          }
        }
      },
    },
  ],
});
