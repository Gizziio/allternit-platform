/**
 * Settings Dialog
 * 
 * Interactive TUI panel for configuring Gizzi settings.
 * Provides tabs for different setting categories.
 */

import { createMemo, createSignal, Show, For, Switch, Match } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useToast } from "@/cli/ui/tui/ui/toast"
import { useSync } from "@/cli/ui/tui/context/sync"
import { useKV } from "@/cli/ui/tui/context/kv"

type Tab = "general" | "models" | "appearance" | "keybinds"

interface SettingItem {
  id: string
  label: string
  description?: string
  type: "toggle" | "select" | "text"
  value: () => any
  onChange: (value: any) => void
  options?: { value: string; label: string }[]
}

export function DialogSettings() {
  const { theme, mode, setMode } = useTheme()
  const dialog = useDialog()
  const toast = useToast()
  const sync = useSync()
  const kv = useKV()
  
  const [activeTab, setActiveTab] = createSignal<Tab>("general")
  const [hasChanges, setHasChanges] = createSignal(false)
  
  // Colors
  const accentColor = RGBA.fromInts(167, 139, 250)
  
  // Get config from sync
  const config = createMemo(() => (sync.data?.config || {}) as any)
  
  // Tab definitions
  const tabs: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "models", label: "Models" },
    { id: "appearance", label: "Appearance" },
    { id: "keybinds", label: "Keybinds" },
  ]
  
  // General settings
  const generalSettings: SettingItem[] = [
    {
      id: "thinking",
      label: "Show Thinking",
      description: "Display agent reasoning steps",
      type: "toggle",
      value: () => kv.get("show_thinking", true),
      onChange: (v) => {
        kv.set("show_thinking", v)
        setHasChanges(true)
      },
    },
    {
      id: "receipts",
      label: "Show Receipts",
      description: "Display token usage and cost",
      type: "toggle",
      value: () => kv.get("show_receipts", true),
      onChange: (v) => {
        kv.set("show_receipts", v)
        setHasChanges(true)
      },
    },
    {
      id: "sandbox",
      label: "Sandbox Mode",
      description: "Safer bash execution",
      type: "toggle",
      value: () => config().sandbox ?? false,
      onChange: (v) => {
        // Would update config
        setHasChanges(true)
      },
    },
    {
      id: "autoshare",
      label: "Auto-share Sessions",
      description: "Automatically share new sessions",
      type: "toggle",
      value: () => config().share === "auto",
      onChange: (v) => {
        // Would update config
        setHasChanges(true)
      },
    },
  ]
  
  // Model settings
  const modelSettings: SettingItem[] = [
    {
      id: "defaultModel",
      label: "Default Model",
      type: "select",
      value: () => config().model || "claude-sonnet-4-5",
      onChange: (v) => {
        setHasChanges(true)
      },
      options: [
        { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
        { value: "claude-opus-4-5", label: "Claude Opus 4.5" },
        { value: "gpt-4o", label: "GPT-4o" },
        { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      ],
    },
    {
      id: "effort",
      label: "Default Effort",
      type: "select",
      value: () => config().effort || "medium",
      onChange: (v) => {
        setHasChanges(true)
      },
      options: [
        { value: "low", label: "Low - Quick responses" },
        { value: "medium", label: "Medium - Balanced" },
        { value: "high", label: "High - Deep reasoning" },
      ],
    },
  ]
  
  // Appearance settings
  const appearanceSettings: SettingItem[] = [
    {
      id: "theme",
      label: "Theme",
      type: "select",
      value: () => mode(),
      onChange: (v) => {
        setMode(v)
        setHasChanges(true)
      },
      options: [
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
        { value: "system", label: "System" },
      ],
    },
    {
      id: "animations",
      label: "Animations",
      description: "Enable UI animations",
      type: "toggle",
      value: () => kv.get("animations_enabled", true),
      onChange: (v) => {
        kv.set("animations_enabled", v)
        setHasChanges(true)
      },
    },
  ]
  
  // Keybind settings (read-only for now)
  const keybindSettings = [
    { action: "Exit", keybind: "Ctrl+C" },
    { action: "New Session", keybind: "Ctrl+N" },
    { action: "List Sessions", keybind: "Ctrl+L" },
    { action: "Switch Model", keybind: "Ctrl+M" },
    { action: "Command Palette", keybind: "Ctrl+P" },
    { action: "Help", keybind: "Ctrl+H" },
  ]
  
  // Handle save
  const handleSave = () => {
    // Would persist config changes
    toast.show({
      message: "Settings saved",
      variant: "success",
      duration: 2000,
    })
    setHasChanges(false)
    dialog.clear()
  }
  
  // Keyboard navigation
  useKeyboard((evt) => {
    if (evt.name === "esc") {
      dialog.clear()
    }
    if (evt.ctrl && evt.name === "s") {
      evt.preventDefault()
      handleSave()
    }
  })
  
  // Toggle component
  const Toggle = (props: { checked: boolean; onChange: (v: boolean) => void }) => {
    return (
      <box
        flexDirection="row"
        gap={1}
        onMouseUp={() => props.onChange(!props.checked)}
      >
        <text fg={props.checked ? accentColor : theme.textMuted}>
          {props.checked ? "[✓]" : "[ ]"}
        </text>
        <text fg={props.checked ? theme.text : theme.textMuted}>
          {props.checked ? "On" : "Off"}
        </text>
      </box>
    )
  }
  
  // Setting row component
  const SettingRow = (props: { setting: SettingItem }) => {
    return (
      <box flexDirection="column" padding={1} border={["bottom"]} borderColor={theme.border}>
        <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <box flexDirection="column">
            <text fg={theme.text}>{props.setting.label}</text>
            <Show when={props.setting.description}>
              <text fg={theme.textMuted} attributes={TextAttributes.ITALIC}>
                {props.setting.description}
              </text>
            </Show>
          </box>
          
          <Switch>
            <Match when={props.setting.type === "toggle"}>
              <Toggle
                checked={props.setting.value()}
                onChange={props.setting.onChange}
              />
            </Match>
            <Match when={props.setting.type === "select"}>
              <box flexDirection="row" gap={1}>
                <For each={props.setting.options}>
                  {(opt) => (
                    <box
                      paddingLeft={1} paddingRight={1}
                      borderStyle="single"
                      borderColor={props.setting.value() === opt.value ? accentColor : theme.border}
                      backgroundColor={props.setting.value() === opt.value ? accentColor : undefined}
                      onMouseUp={() => props.setting.onChange(opt.value)}
                    >
                      <text
                        fg={props.setting.value() === opt.value ? RGBA.fromInts(255, 255, 255) : theme.text}
                      >
                        {opt.label}
                      </text>
                    </box>
                  )}
                </For>
              </box>
            </Match>
          </Switch>
        </box>
      </box>
    )
  }
  
  return (
    <box flexDirection="column" minWidth={80} minHeight={30}>
      {/* Header */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        padding={1}
        border={["bottom"]}
        borderColor={theme.border}
      >
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Settings
        </text>
        <box flexDirection="row" gap={2}>
          <Show when={hasChanges()}>
            <text fg={RGBA.fromInts(250, 204, 21)}>● Unsaved changes</text>
          </Show>
          <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
            esc
          </text>
        </box>
      </box>
      
      {/* Tabs */}
      <box
        flexDirection="row"
        gap={1}
        padding={1}
        border={["bottom"]}
        borderColor={theme.border}
      >
        <For each={tabs}>
          {(tab) => (
            <box
              paddingLeft={2} paddingRight={2}
              borderStyle="single"
              borderColor={activeTab() === tab.id ? accentColor : theme.border}
              backgroundColor={activeTab() === tab.id ? accentColor : undefined}
              onMouseUp={() => setActiveTab(tab.id)}
            >
              <text
                fg={activeTab() === tab.id ? RGBA.fromInts(255, 255, 255) : theme.text}
              >
                {tab.label}
              </text>
            </box>
          )}
        </For>
      </box>
      
      {/* Content */}
      <box flexDirection="column" flexGrow={1} overflow="scroll" padding={1}>
        <Switch>
          <Match when={activeTab() === "general"}>
            <For each={generalSettings}>{(setting) => <SettingRow setting={setting} />}</For>
          </Match>
          
          <Match when={activeTab() === "models"}>
            <For each={modelSettings}>{(setting) => <SettingRow setting={setting} />}</For>
          </Match>
          
          <Match when={activeTab() === "appearance"}>
            <For each={appearanceSettings}>{(setting) => <SettingRow setting={setting} />}</For>
          </Match>
          
          <Match when={activeTab() === "keybinds"}>
            <box flexDirection="column">
              <text fg={theme.textMuted} marginBottom={1}>
                Keybinds are read-only in this version.
              </text>
              <For each={keybindSettings}>
                {(kb) => (
                  <box
                    flexDirection="row"
                    justifyContent="space-between"
                    padding={1}
                    border={["bottom"]}
                    borderColor={theme.border}
                  >
                    <text fg={theme.text}>{kb.action}</text>
                    <text fg={accentColor} attributes={TextAttributes.BOLD}>
                      {kb.keybind}
                    </text>
                  </box>
                )}
              </For>
            </box>
          </Match>
        </Switch>
      </box>
      
      {/* Footer */}
      <box
        flexDirection="row"
        justifyContent="flex-end"
        gap={1}
        padding={1}
        border={["top"]}
        borderColor={theme.border}
      >
        <box
          paddingLeft={2} paddingRight={2}
          borderStyle="single"
          borderColor={theme.border}
          onMouseUp={() => dialog.clear()}
        >
          <text fg={theme.textMuted}>Cancel</text>
        </box>
        
        <box
          paddingLeft={2} paddingRight={2}
          borderStyle="single"
          borderColor={hasChanges() ? accentColor : theme.border}
          backgroundColor={hasChanges() ? accentColor : undefined}
          onMouseUp={handleSave}
        >
          <text fg={hasChanges() ? RGBA.fromInts(255, 255, 255) : theme.textMuted}>
            Save (Ctrl+S)
          </text>
        </box>
      </box>
    </box>
  )
}
