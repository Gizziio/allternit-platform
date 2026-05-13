import {
  code as baseCodePlugin,
  createCodePlugin as createBaseCodePlugin,
  type CodePluginOptions,
} from "@streamdown/code";
import type { CodeHighlighterPlugin } from "streamdown";

// @streamdown/code@1.1.1 depends on shiki@3.x while streamdown@2.5.0 resolves
// shiki@1.x — the BundledLanguage unions differ structurally. The runtime API
// is identical so we bridge with a double assertion at the type boundary.
export const code: CodeHighlighterPlugin =
  baseCodePlugin as unknown as CodeHighlighterPlugin;

export function createCodePlugin(
  options?: CodePluginOptions,
): CodeHighlighterPlugin {
  return createBaseCodePlugin(options) as unknown as CodeHighlighterPlugin;
}
