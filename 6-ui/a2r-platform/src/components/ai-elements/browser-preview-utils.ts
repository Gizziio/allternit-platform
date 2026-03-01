import type { ExtendedUIPart, WebPreviewUIPart } from "@/lib/ai/rust-stream-adapter-extended";

export interface PreviewCandidate {
  url: string;
  title: string;
}

const PREVIEW_TOOL_PATTERN =
  /\b(browser|agentbrowser|web[_-]?search|retrieve[_-]?url|search|web)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePreviewUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const normalized = new URL(trimmed).toString();
    return /^https?:\/\//i.test(normalized) ? normalized : null;
  } catch {
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return null;
  }
}

export function inferPreviewTitle(url: string, fallback?: string): string {
  if (fallback && fallback.trim()) {
    return fallback.trim();
  }

  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

export function isBrowserPreviewToolName(toolName?: string): boolean {
  return typeof toolName === "string" && PREVIEW_TOOL_PATTERN.test(toolName);
}

function pushCandidate(
  candidates: PreviewCandidate[],
  seenUrls: Set<string>,
  url: unknown,
  title?: unknown,
): void {
  if (typeof url !== "string") return;

  const normalizedUrl = normalizePreviewUrl(url);
  if (!normalizedUrl || seenUrls.has(normalizedUrl)) {
    return;
  }

  seenUrls.add(normalizedUrl);
  candidates.push({
    url: normalizedUrl,
    title: inferPreviewTitle(normalizedUrl, typeof title === "string" ? title : undefined),
  });
}

function collectPreviewCandidates(
  value: unknown,
  candidates: PreviewCandidate[],
  seenUrls: Set<string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectPreviewCandidates(entry, candidates, seenUrls));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  pushCandidate(candidates, seenUrls, value.url, value.title ?? value.name ?? value.label);

  for (const key of ["results", "items", "sources", "documents", "citations", "pages", "links"]) {
    if (Array.isArray(value[key])) {
      collectPreviewCandidates(value[key], candidates, seenUrls);
    }
  }
}

export function extractPreviewCandidatesFromToolPart(
  part: Extract<ExtendedUIPart, { type: "dynamic-tool" }>,
): PreviewCandidate[] {
  if (part.state !== "output-available" || !isBrowserPreviewToolName(part.toolName)) {
    return [];
  }

  const candidates: PreviewCandidate[] = [];
  const seenUrls = new Set<string>();

  if ("result" in part) {
    collectPreviewCandidates(part.result, candidates, seenUrls);
  }

  if (candidates.length === 0 && isRecord(part.input)) {
    pushCandidate(candidates, seenUrls, part.input.url, part.input.title);
  }

  return candidates.slice(0, 1);
}

export function injectWebPreviewParts(parts: ExtendedUIPart[]): ExtendedUIPart[] {
  const augmented: ExtendedUIPart[] = [];
  const existingPreviewUrls = new Set(
    parts
      .filter((part): part is Extract<ExtendedUIPart, { type: "web-preview" }> => part.type === "web-preview")
      .map((part) => normalizePreviewUrl(part.url))
      .filter((url): url is string => Boolean(url)),
  );

  for (const part of parts) {
    augmented.push(part);

    if (part.type !== "dynamic-tool") {
      continue;
    }

    const candidates = extractPreviewCandidatesFromToolPart(part);
    for (const [index, candidate] of candidates.entries()) {
      if (existingPreviewUrls.has(candidate.url)) {
        continue;
      }

      existingPreviewUrls.add(candidate.url);
      const previewPart: WebPreviewUIPart = {
        type: "web-preview",
        previewId: `${part.toolCallId}-preview-${index + 1}`,
        url: candidate.url,
        title: candidate.title,
      };
      augmented.push(previewPart);
    }
  }

  return augmented;
}
