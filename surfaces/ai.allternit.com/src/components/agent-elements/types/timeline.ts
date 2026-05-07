export type StepState = "animating" | "complete";

export type TimelineToolVariant = "thinking" | "action" | "search" | undefined;

export type TimelineToolCallStep = {
  id: string;
  type: "tool-call";
  toolName: string;
  toolDetail?: string;
  duration: number;
  toolVariant?: TimelineToolVariant;
  bashCommand?: string;
  bashOutput?: string;
  bashSuccess?: boolean;
  filePath?: string;
  diffStats?: string;
  diffLines?: Array<{ type: "add" | "remove" | "context"; content: string }>;
  searchQuery?: string;
  searchSource?: "web" | "code";
  thoughtContent?: string;
};

export type TimelineStep = TimelineToolCallStep;
