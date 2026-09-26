// §A3.1 — fillComposer / submit shared primitives.
import type { Page } from "playwright";
import type { SdkSelectorResolver } from "./selectors";

const LONG_TEXT_THRESHOLD = 500;

// Handles contenteditable and textarea composers; long prompts go through
// insertText (never per-key typing).
export async function fillComposer(
  page: Page,
  resolver: SdkSelectorResolver,
  text: string,
  opts: { key?: string } = {}
): Promise<void> {
  const locator = await resolver.resolveLocator(opts.key ?? "composer");
  const target = locator.first();
  const kind = await target.evaluate((el) => {
    const tag = el.tagName.toUpperCase();
    if (tag === "TEXTAREA" || tag === "INPUT") return "field";
    if ((el as HTMLElement).isContentEditable) return "contenteditable";
    return "unknown";
  });

  if (kind === "field") {
    await target.fill(text);
    return;
  }
  await target.click();
  if (text.length > LONG_TEXT_THRESHOLD) {
    await page.keyboard.insertText(text);
  } else {
    await target.pressSequentially(text);
  }
}

export interface SubmitOptions {
  composerKey?: string;
  sendKey?: string;
  // Pack hint: allow pressing Enter in the composer when the send button is
  // missing or disabled.
  fallback?: "enter";
}

export async function submit(
  page: Page,
  resolver: SdkSelectorResolver,
  opts: SubmitOptions = {}
): Promise<void> {
  const sendLoc = await resolver.tryResolveLocator(opts.sendKey ?? "send_button");
  if (sendLoc && (await sendLoc.first().isEnabled())) {
    await sendLoc.first().click();
    return;
  }
  if (opts.fallback === "enter") {
    const composer = await resolver.resolveLocator(opts.composerKey ?? "composer");
    await composer.first().click();
    await page.keyboard.press("Enter");
    return;
  }
  throw new Error("submit: send button unavailable and no fallback configured");
}
