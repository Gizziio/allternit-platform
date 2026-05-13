import { memo } from "react";
import { IconSparkles, IconExternalLink } from "@tabler/icons-react";
import { ToolRowBase } from "./tool-row-base";
import { cn } from "../utils/cn";

export type ExaResult = {
  title: string;
  url: string;
  summary: string;
  score: number;
  publishedDate?: string;
  author?: string;
};

export type ExaSearchData = {
  query?: string;
  numResults?: number;
  results?: ExaResult[];
  error?: string;
};

export type ExaToolProps = {
  part: {
    id?: string;
    toolCallId?: string;
    type?: string;
    state?: string;
    input?: Record<string, unknown>;
    args?: Record<string, unknown>;
    output?: Record<string, unknown>;
    result?: Record<string, unknown>;
  };
  defaultOpen?: boolean;
};

function normalizeExaResult(value: unknown): ExaSearchData | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const rawResults = Array.isArray(v.results) ? v.results : undefined;
  const results: ExaResult[] | undefined = rawResults
    ?.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const r = item as Record<string, unknown>;
      const url = typeof r.url === "string" ? r.url : "";
      if (!url) return [];
      return [{
        title: typeof r.title === "string" ? r.title : url,
        url,
        summary:
          typeof r.summary === "string"
            ? r.summary
            : typeof r.text === "string"
              ? r.text
              : "",
        score: typeof r.score === "number" ? r.score : 0,
        publishedDate: typeof r.publishedDate === "string" ? r.publishedDate : undefined,
        author: typeof r.author === "string" ? r.author : undefined,
      }];
    });

  return {
    query: typeof v.query === "string" ? v.query : undefined,
    numResults: typeof v.numResults === "number" ? v.numResults : results?.length,
    results,
    error: typeof v.error === "string" ? v.error : undefined,
  };
}

export const ExaTool = memo(function ExaTool({
  part,
  defaultOpen = false,
}: ExaToolProps) {
  const isPending =
    part.state !== "output-available" && part.state !== "output-error";
  const hasError = part.state === "output-error";

  const data =
    normalizeExaResult(part.output) ??
    normalizeExaResult(part.result) ??
    {};

  const inputQuery =
    (part.input?.query as string) || (part.args?.query as string) || "";
  const query = data.query || inputQuery;

  const hasContent = !!(data.results?.length || data.error);

  return (
    <ToolRowBase
      icon={<IconSparkles className="w-full h-full text-muted-foreground" />}
      shimmerLabel="Searching Exa..."
      completeLabel={
        hasError
          ? "Search failed"
          : data.numResults
            ? `Found ${data.numResults} result${data.numResults === 1 ? "" : "s"}`
            : "Search complete"
      }
      isAnimating={isPending}
      expandable={hasContent}
      defaultOpen={defaultOpen}
      detail={query}
    >
      <div className="rounded-an-tool-border-radius border border-border bg-an-tool-background overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-an-tool-border-color bg-background/50">
          <IconSparkles className="size-3.5  text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Exa Search
          </span>
          {query && (
            <span className="text-xs text-muted-foreground/60 truncate">
              &ldquo;{query}&rdquo;
            </span>
          )}
        </div>

        {/* Error */}
        {data.error && (
          <div className="px-3 py-2 text-sm text-destructive bg-destructive/5">
            {data.error}
          </div>
        )}

        {/* Results */}
        {data.results && data.results.length > 0 && (
          <div className="flex flex-col gap-0 max-h-[280px] overflow-y-auto">
            {data.results.map((result, i) => (
              <div
                key={i}
                className={cn(
                  "px-3 py-2",
                  i < data.results!.length - 1 && "border-b border-an-tool-border-color"
                )}
              >
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground group-hover:underline truncate">
                        {result.title}
                      </span>
                      <IconExternalLink className="size-3  shrink-0 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[12px] text-muted-foreground truncate">
                        {(() => {
                          try {
                            return new URL(result.url).hostname.replace("www.", "");
                          } catch {
                            return result.url;
                          }
                        })()}
                      </span>
                      {result.score > 0 && (
                        <span className="text-xs px-1.5 py-0 rounded-full bg-primary/10 text-primary font-medium">
                          {result.score.toFixed(2)}
                        </span>
                      )}
                      {result.publishedDate && (
                        <span className="text-[12px] text-muted-foreground/60">
                          {result.publishedDate}
                        </span>
                      )}
                    </div>
                    {result.summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {result.summary}
                      </p>
                    )}
                  </div>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolRowBase>
  );
});
