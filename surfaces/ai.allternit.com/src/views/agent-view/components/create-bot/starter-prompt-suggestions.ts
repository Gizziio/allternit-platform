/**
 * Create Bot wizard — starter-prompt suggestions per bot category.
 *
 * Keyed by the exact BotCategory ids the IdentityStep category Select uses
 * (see CATEGORY_OPTIONS in steps/IdentityStep.tsx and BOT_CATEGORIES in
 * lib/bots/bot-profile.ts). The `default` list covers unknown/custom values.
 */

export const STARTER_PROMPT_MAX = 5;

export const STARTER_PROMPT_SUGGESTIONS: Record<string, string[]> = {
  research: [
    "Summarize the latest news on…",
    "Compare these three sources and list what they disagree on",
    "Research the market for… and give me a one-page brief",
    "Find five credible sources about…",
    "Track this topic weekly and flag what changed",
    "Turn these notes into an annotated reading list",
    "What are the strongest arguments against…?",
    "Build a timeline of… with sources",
  ],
  code: [
    "Review this diff and flag anything risky",
    "Write a failing test for this function, then make it pass",
    "Explain this stack trace and suggest a fix",
    "Refactor this file for readability, keep behavior identical",
    "Generate a migration script for…",
    "Find the bug: here's the code and the error…",
    "Draft a README section for…",
    "Set up a CI check that runs…",
  ],
  writing: [
    "Rewrite this email to be shorter and direct",
    "Draft a blog post outline about…",
    "Edit this paragraph for Register 1: plain, no hype",
    "Write three headline options for…",
    "Turn these bullet points into a one-page brief",
    "Proofread this and list every factual claim to verify",
    "Continue this draft in the same voice",
    "Summarize this article in five sentences",
  ],
  data: [
    "Chart this CSV and call out the outliers",
    "Clean this dataset and report what you dropped",
    "Join these two tables on… and summarize the result",
    "Build a weekly report from these numbers",
    "What trends do you see in this data?",
    "Convert this spreadsheet to a formatted table",
    "Run a sanity check on these figures",
    "Explain this SQL query line by line",
  ],
  sales: [
    "Draft a follow-up email for this lead",
    "Score these leads and tell me who to call first",
    "Research this company before my call — bullet points",
    "Write a one-paragraph pitch for…",
    "Summarize this call transcript into CRM notes",
    "Find 10 prospects that match our ICP",
    "Draft outreach for… in a plain, direct tone",
    "Review this proposal for anything that overpromises",
  ],
  design: [
    "Critique this landing page layout",
    "Suggest a color palette for…",
    "Rewrite this UI copy to be clearer",
    "Turn this wireframe description into a spec",
    "Audit this page for accessibility issues",
    "Generate three layout options for…",
    "What would make this form feel shorter?",
    "Compare our homepage to these two competitors",
  ],
  ops: [
    "Check this process for steps we can automate",
    "Draft a runbook for…",
    "Summarize today's failed jobs and what to retry",
    "Watch this inbox and route messages to the right owner",
    "Prepare the weekly status report from these updates",
    "Reconcile this inventory list against the system of record",
    "Flag anything in this log that needs action today",
    "Write the onboarding checklist for…",
  ],
  custom: [
    "What can you help me with?",
    "Summarize my last session",
    "Walk me through how you work",
    "Remember this for next time…",
    "What should I set up first?",
    "Give me a quick status update",
  ],
  default: [
    "What can you help me with?",
    "Summarize the last conversation",
    "Walk me through how you work",
    "Remember this for next time…",
    "Draft a starting point for…",
    "Review this and list what needs attention",
  ],
};

/**
 * Suggestions for a category id — the category list, or the `default` list
 * for unknown/empty ids (the Select value can be any BotCategory string).
 */
export function starterPromptSuggestionsFor(category: string | undefined): string[] {
  if (category && STARTER_PROMPT_SUGGESTIONS[category]) {
    return STARTER_PROMPT_SUGGESTIONS[category];
  }
  return STARTER_PROMPT_SUGGESTIONS.default;
}

/**
 * Append a suggestion to the current list. Returns null when the prompt is a
 * duplicate or the cap is reached — callers use null to keep the chip
 * disabled. Trims and ignores empty strings.
 */
export function addStarterPrompt(
  current: string[] | undefined,
  prompt: string,
  max: number = STARTER_PROMPT_MAX,
): string[] | null {
  const trimmed = prompt.trim();
  const list = current ?? [];
  if (!trimmed || list.includes(trimmed) || list.length >= max) return null;
  return [...list, trimmed];
}
