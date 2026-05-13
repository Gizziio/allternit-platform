import { memo } from "react";
import { IconMail, IconSend, IconUser, IconAt } from "@tabler/icons-react";
import { ToolRowBase } from "./tool-row-base";
import { TextShimmer } from "../text-shimmer";
import { cn } from "../utils/cn";

export type EmailDraft = {
  to?: string;
  from?: string;
  subject?: string;
  body?: string;
  cc?: string[];
  bcc?: string[];
};

export type EmailDraftToolProps = {
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

function normalizeEmailDraft(value: unknown): EmailDraft | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  return {
    to: typeof v.to === "string" ? v.to : undefined,
    from: typeof v.from === "string" ? v.from : undefined,
    subject: typeof v.subject === "string" ? v.subject : undefined,
    body: typeof v.body === "string" ? v.body : typeof v.message === "string" ? v.message : undefined,
    cc: Array.isArray(v.cc) ? v.cc.filter((s): s is string => typeof s === "string") : undefined,
    bcc: Array.isArray(v.bcc) ? v.bcc.filter((s): s is string => typeof s === "string") : undefined,
  };
}

export const EmailDraftTool = memo(function EmailDraftTool({
  part,
  defaultOpen = false,
}: EmailDraftToolProps) {
  const isPending =
    part.state !== "output-available" && part.state !== "output-error";

  const draft =
    normalizeEmailDraft(part.output) ??
    normalizeEmailDraft(part.result) ??
    normalizeEmailDraft(part.input) ??
    normalizeEmailDraft(part.args) ??
    {};

  const hasContent = !!(draft.to || draft.subject || draft.body);

  return (
    <ToolRowBase
      icon={<IconMail className="w-full h-full text-muted-foreground" />}
      shimmerLabel="Drafting email..."
      completeLabel={draft.subject ? `Drafted: ${draft.subject}` : "Email drafted"}
      isAnimating={isPending}
      expandable={hasContent}
      defaultOpen={defaultOpen}
    >
      <div className="rounded-an-tool-border-radius border border-border bg-an-tool-background overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-an-tool-border-color bg-background/50">
          <IconSend className="size-3.5  text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Email Draft</span>
        </div>
        <div className="p-3 space-y-2">
          {draft.to && (
            <div className="flex items-center gap-2 text-sm">
              <IconUser className="size-3.5  text-muted-foreground shrink-0" />
              <span className="text-muted-foreground text-xs uppercase tracking-wide w-12">To</span>
              <span className="text-foreground truncate">{draft.to}</span>
            </div>
          )}
          {draft.from && (
            <div className="flex items-center gap-2 text-sm">
              <IconAt className="size-3.5  text-muted-foreground shrink-0" />
              <span className="text-muted-foreground text-xs uppercase tracking-wide w-12">From</span>
              <span className="text-foreground truncate">{draft.from}</span>
            </div>
          )}
          {draft.subject && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground text-xs uppercase tracking-wide w-12 pl-[22px]">Subject</span>
              <span className="text-foreground font-medium truncate">{draft.subject}</span>
            </div>
          )}
          {draft.cc && draft.cc.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground text-xs uppercase tracking-wide w-12 pl-[22px]">CC</span>
              <span className="text-foreground truncate">{draft.cc.join(", ")}</span>
            </div>
          )}
          {draft.body && (
            <div className="pt-2 border-t border-an-tool-border-color">
              <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                {draft.body}
              </div>
            </div>
          )}
        </div>
      </div>
    </ToolRowBase>
  );
});
