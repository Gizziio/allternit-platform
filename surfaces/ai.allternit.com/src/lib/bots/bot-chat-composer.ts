/**
 * Shared composer bindings for bot-chat consumers (PWA + web).
 *
 * Maps stored routines onto BotComposer chips/HUD. Action rows are built by
 * the consumer (attach / new thread / watch / share / interrupt) so this
 * file stays free of view/session imports.
 *
 * @module bot-chat-composer
 */

import {
  getRoutinesForBot,
  routinePrompt,
} from "@/lib/bots/bot-routine.service";
import type {
  BotComposerCommand,
  BotComposerSuggestion,
} from "@/components/bot-chat/BotComposer";

export function routinesToComposerProps(botId: string): {
  suggestions: BotComposerSuggestion[];
  commands: BotComposerCommand[];
} {
  const routines = getRoutinesForBot(botId).filter((r) => r.enabled);
  const suggestions = routines.map((r) => ({
    id: r.id,
    label: r.title,
    prompt: routinePrompt(r.botName, r.title, r.instruction),
  }));
  const commands = routines.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.instruction,
    action: "prompt" as const,
    prompt: routinePrompt(r.botName, r.title, r.instruction),
  }));
  return { suggestions, commands };
}

export function transcriptToShareText(lines: string[], botName: string): string {
  const body = lines.join("\n").trim();
  return body ? `${botName}\n\n${body}` : botName;
}
