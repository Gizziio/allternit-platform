/**
 * Tag subsystem types for Allternit.
 *
 * Tags are lightweight, user-managed labels that can be attached to agents,
 * tools, scripts, artifacts, sessions, and other platform entities.
 */

export type TagScope =
  | "agent"
  | "tool"
  | "script"
  | "artifact"
  | "session"
  | "plugin"
  | "mcp"
  | "skill"
  | "global";

export interface Tag {
  id: string;
  label: string;
  color: TagColor;
  icon?: string; // Phosphor icon name, e.g. "Tag"
  scope: TagScope | "global";
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type TagColor =
  | "slate"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "green"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose";

export interface Tagging {
  id: string;
  tagId: string;
  targetId: string;
  targetType: TagScope;
  createdAt: string;
}

export interface TagFilterState {
  includedTagIds: string[];
  excludedTagIds: string[];
  scope: TagScope | "all";
}

export const TAG_COLOR_STYLES: Record<TagColor, { bg: string; text: string; border: string }> = {
  slate:   { bg: "bg-slate-500/15",   text: "text-slate-300",   border: "border-slate-500/30" },
  red:     { bg: "bg-red-500/15",     text: "text-red-300",     border: "border-red-500/30" },
  orange:  { bg: "bg-orange-500/15",  text: "text-orange-300",  border: "border-orange-500/30" },
  amber:   { bg: "bg-amber-500/15",   text: "text-amber-300",   border: "border-amber-500/30" },
  yellow:  { bg: "bg-yellow-500/15",  text: "text-yellow-300",  border: "border-yellow-500/30" },
  lime:    { bg: "bg-lime-500/15",    text: "text-lime-300",    border: "border-lime-500/30" },
  green:   { bg: "bg-green-500/15",   text: "text-green-300",   border: "border-green-500/30" },
  emerald: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30" },
  teal:    { bg: "bg-teal-500/15",    text: "text-teal-300",    border: "border-teal-500/30" },
  cyan:    { bg: "bg-cyan-500/15",    text: "text-cyan-300",    border: "border-cyan-500/30" },
  sky:     { bg: "bg-sky-500/15",     text: "text-sky-300",     border: "border-sky-500/30" },
  blue:    { bg: "bg-blue-500/15",    text: "text-blue-300",    border: "border-blue-500/30" },
  indigo:  { bg: "bg-indigo-500/15",  text: "text-indigo-300",  border: "border-indigo-500/30" },
  violet:  { bg: "bg-violet-500/15",  text: "text-violet-300",  border: "border-violet-500/30" },
  purple:  { bg: "bg-purple-500/15",  text: "text-purple-300",  border: "border-purple-500/30" },
  fuchsia: { bg: "bg-fuchsia-500/15", text: "text-fuchsia-300", border: "border-fuchsia-500/30" },
  pink:    { bg: "bg-pink-500/15",    text: "text-pink-300",    border: "border-pink-500/30" },
  rose:    { bg: "bg-rose-500/15",    text: "text-rose-300",    border: "border-rose-500/30" },
};
