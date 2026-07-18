/**
 * Settings Types
 */

export interface Settings {
  theme?: string
  autoCompact?: boolean
  [key: string]: unknown
}

export interface PluginHookMatcher {
  plugin: string
  hook: string
}

export interface HooksSettings {
  [hook: string]: unknown
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { AllowedMcpServerEntrySchema, CUSTOMIZATION_SURFACES, DeniedMcpServerEntrySchema, EnvironmentVariablesSchema, ExtraKnownMarketplaceSchema, HookCommandSchema, HookMatcherSchema, HooksSchema, PermissionsSchema, SettingsSchema, isMcpServerCommandEntry, isMcpServerNameEntry, isMcpServerUrlEntry } from "../../shared/utils/settings/types.js";
export type { AgentHook, AllowedMcpServerEntry, BashCommandHook, DeniedMcpServerEntry, HookCommand, HookMatcher, HttpHook, PluginConfig, PromptHook, SettingsJson, SkillHookMatcher, UserConfigValues } from "../../shared/utils/settings/types.js";
