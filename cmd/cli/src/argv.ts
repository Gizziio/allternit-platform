/**
 * Rewrite the `--api` global flag alias to `--api-url`.
 *
 * Commander derives an option's attribute name from its LAST long flag, so
 * declaring `--api-url, --api <url>` would rename the option to `api` and
 * break every consumer reading `opts.apiUrl`. Normalizing argv keeps one
 * canonical option while accepting both spellings (`--api URL`, `--api=URL`).
 */
export function normalizeApiAlias(argv: string[]): string[] {
  return argv.map((arg) => {
    if (arg === '--api') return '--api-url';
    if (arg.startsWith('--api=')) return `--api-url=${arg.slice('--api='.length)}`;
    return arg;
  });
}
