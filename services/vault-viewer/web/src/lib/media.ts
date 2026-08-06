// Obsidian-parity media extension sets, shared across the Live Preview editor,
// the Reading-view renderer (markdown.ts) and the direct file view (Workspace).
// Mirrors the desktop app's image/audio/video extension groups so `![[x.mp4]]`
// and opening a media file behave the same as Obsidian.
export const VIDEO_EXT_RE = /\.(mp4|webm|ogv|mov|mkv)$/i;
export const AUDIO_EXT_RE = /\.(mp3|wav|m4a|3gp|flac|ogg|oga|opus)$/i;

export type MediaKind = 'video' | 'audio';

/** Media kind for an embed/file target (ignoring any `#fragment`), else null. */
export function mediaKind(target: string): MediaKind | null {
  const t = target.split('#')[0];
  if (VIDEO_EXT_RE.test(t)) return 'video';
  if (AUDIO_EXT_RE.test(t)) return 'audio';
  return null;
}
