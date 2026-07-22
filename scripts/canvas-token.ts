/**
 * Centralized Canvas API token loader.
 *
 * Reads from the environment first (CANVAS_TOKEN, then CANVAS_API_TOKEN)
 * and falls back to the legacy hardcoded token so existing scripts keep
 * working when no env var is set.
 */
export function getCanvasToken(): string {
  return (
    process.env.CANVAS_TOKEN ??
    process.env.CANVAS_API_TOKEN ??
    '7~rPDcCXrVEvBrN6TDGQVDNm2uAxKxGe4cnc2TvuTXUAxEEAKTBEWVUTLTvyaJC2hc'
  );
}
