import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Extract text content from a model message
 */
export function getTextContentFromModelMessage(message: unknown): string {
  if (typeof message === "string") {
    return message;
  }
  if (message && typeof message === "object") {
    const msg = message as { content?: string; text?: string };
    return msg.content ?? msg.text ?? "";
  }
  return "";
}
