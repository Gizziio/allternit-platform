/**
 * Provider Setup Dialog
 * 
 * Interactive TUI dialog for adding and configuring LLM providers.
 * Guides users through provider selection, authentication, and testing.
 */

import { createMemo, createSignal, Show, Match, Switch } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useToast } from "@/cli/ui/tui/ui/toast"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { Log } from "@/runtime/util/log"

// Known provider catalog
const KNOWN_PROVIDERS = [
  { id: "anthropic", name: "Anthropic", authType: "api_key", baseUrl: "https://api.allternit.io/v1", keyUrl: "https://console.allternit.io/keys" },
  { id: "openai", name: "OpenAI", authType: "api_key", baseUrl: "https://api.openai.com/v1", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "google", name: "Google AI", authType: "api_key", baseUrl: "https://generativelanguage.googleapis.com/v1beta", keyUrl: "https://aistudio.google.com/app/apikey" },
  { id: "moonshot", name: "Kimi (Moonshot)", authType: "api_key", baseUrl: "https://api.moonshot.ai/v1", keyUrl: "https://platform.moonshot.cn/console" },
  { id: "ollama", name: "Ollama", authType: "none", baseUrl: "http://localhost:11434/v1" },
  { id: "custom", name: "Custom Provider", authType: "api_key", baseUrl: "" },
] as const

type Step = "select" | "auth" | "test" | "success"

export function DialogProviderSetup() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const toast = useToast()
  const sdk = useSDK()
  
  const [step, setStep] = createSignal<Step>("select")
  const [selectedProvider, setSelectedProvider] = createSignal<typeof KNOWN_PROVIDERS[number] | null>(null)
  const [providerId, setProviderId] = createSignal("")
  const [providerName, setProviderName] = createSignal("")
  const [baseUrl, setBaseUrl] = createSignal("")
  const [apiKey, setApiKey] = createSignal("")
  const [testing, setTesting] = createSignal(false)
  const [testResult, setTestResult] = createSignal<{ success: boolean; message: string } | null>(null)
  
  // Colors
  const successColor = RGBA.fromInts(74, 222, 128)
  const errorColor = RGBA.fromInts(248, 113, 113)
  const accentColor = RGBA.fromInts(167, 139, 250)
  
  // Handle provider selection
  const handleSelectProvider = (provider: typeof KNOWN_PROVIDERS[number]) => {
    setSelectedProvider(provider)
    setProviderId(provider.id)
    setProviderName(provider.name)
    setBaseUrl(provider.baseUrl)
    setStep("auth")
  }
  
  // Handle custom provider
  const handleCustomProvider = () => {
    const custom = KNOWN_PROVIDERS.find((p) => p.id === "custom")!
    setSelectedProvider(custom)
    setProviderId("")
    setProviderName("")
    setBaseUrl("")
    setStep("auth")
  }
  
  // Test connection
  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    
    try {
      const result = await (sdk.client as any).provider.test({
        body: {
          providerId: providerId(),
          baseUrl: baseUrl(),
          apiKey: apiKey(),
        },
      })
      
      const data = (result ?? { success: false, error: "Unknown error" }) as any
      
      if (data.success) {
        setTestResult({ success: true, message: "Connection successful!" })
      } else {
        setTestResult({ success: false, message: data.error || "Connection failed" })
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || "Test failed" })
    } finally {
      setTesting(false)
    }
  }
  
  // Save provider
  const handleSave = async () => {
    try {
      await (sdk.client as any).provider.add({
        body: {
          id: providerId(),
          name: providerName(),
          baseUrl: baseUrl(),
          apiKey: apiKey(),
        },
      })
      
      toast.show({
        message: `Provider "${providerName()}" added successfully`,
        variant: "success",
        duration: 3000,
      })
      
      dialog.clear()
    } catch (err: any) {
      toast.show({
        message: err?.message || "Failed to save provider",
        variant: "error",
        duration: 3000,
      })
    }
  }
  
  // Keyboard navigation
  useKeyboard((evt) => {
    if (evt.name === "esc") {
      if (step() === "select") {
        dialog.clear()
      } else {
        setStep("select")
      }
    }
  })
  
  return (
    <box flexDirection="column" padding={2} gap={1} minWidth={60}>
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom={1}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Add Provider
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      
      <Switch>
        {/* Step 1: Select Provider */}
        <Match when={step() === "select"}>
          <text fg={theme.textMuted} marginBottom={1}>
            Select a provider to configure:
          </text>
          
          <box flexDirection="column" gap={1}>
            {KNOWN_PROVIDERS.filter((p) => p.id !== "custom").map((provider) => (
              <box
                flexDirection="row"
                padding={1}
                borderStyle="single"
                borderColor={theme.border}
                onMouseUp={() => handleSelectProvider(provider)}
              >
                <text fg={theme.text} flexGrow={1}>
                  {provider.name}
                </text>
                <text fg={theme.textMuted}>
                  {provider.authType === "none" ? "Local" : "API Key"}
                </text>
              </box>
            ))}
            
            <box
              flexDirection="row"
              padding={1}
              borderStyle="single"
              borderColor={theme.border}
              onMouseUp={handleCustomProvider}
            >
              <text fg={accentColor} flexGrow={1}>
                Custom Provider...
              </text>
              <text fg={theme.textMuted}>Manual setup</text>
            </box>
          </box>
        </Match>
        
        {/* Step 2: Authentication */}
        <Match when={step() === "auth"}>
          <Show when={(selectedProvider() as any)?.keyUrl}>
            <text fg={accentColor} marginBottom={1}>
              Get your API key: {(selectedProvider() as any)?.keyUrl}
            </text>
          </Show>
          
          <box flexDirection="column" gap={1}>
            {/* Provider ID */}
            <box flexDirection="column">
              <text fg={theme.textMuted}>Provider ID</text>
              <input
                value={providerId()}
                onInput={setProviderId}
                placeholder="e.g., anthropic"
              />
            </box>
            
            {/* Display Name */}
            <box flexDirection="column">
              <text fg={theme.textMuted}>Display Name</text>
              <input
                value={providerName()}
                onInput={setProviderName}
                placeholder="e.g., Anthropic"
              />
            </box>
            
            {/* Base URL */}
            <box flexDirection="column">
              <text fg={theme.textMuted}>API Base URL</text>
              <input
                value={baseUrl()}
                onInput={setBaseUrl}
                placeholder="https://api.example.com/v1"
              />
            </box>
            
            {/* API Key */}
            <Show when={selectedProvider()?.authType === "api_key"}>
              <box flexDirection="column">
                <text fg={theme.textMuted}>API Key</text>
                <input
                  value={apiKey()}
                  onInput={setApiKey}
                  placeholder="sk-..."
                />
              </box>
            </Show>
            
            {/* Buttons */}
            <box flexDirection="row" gap={1} marginTop={1}>
              <box
                paddingLeft={2} paddingRight={2}
                borderStyle="single"
                borderColor={theme.border}
                onMouseUp={() => setStep("select")}
              >
                <text fg={theme.textMuted}>Back</text>
              </box>
              
              <box
                paddingLeft={2} paddingRight={2}
                borderStyle="single"
                borderColor={theme.primary}
                backgroundColor={theme.primary}
                onMouseUp={() => setStep("test")}
              >
                <text fg={RGBA.fromInts(255, 255, 255)}>Continue</text>
              </box>
            </box>
          </box>
        </Match>
        
        {/* Step 3: Test Connection */}
        <Match when={step() === "test"}>
          <box flexDirection="column" gap={1}>
            <text fg={theme.text}>
              Testing connection to {providerName()}...
            </text>
            
            <box
              flexDirection="row"
              padding={1}
              borderStyle="single"
              borderColor={theme.border}
              onMouseUp={handleTest}
              backgroundColor={testing() ? theme.backgroundPanel : undefined}
            >
              <text fg={testing() ? theme.textMuted : theme.text}>
                {testing() ? "Testing..." : "Test Connection"}
              </text>
            </box>
            
            <Show when={testResult()}>
              <box
                flexDirection="column"
                padding={1}
                borderStyle="single"
                borderColor={testResult()?.success ? successColor : errorColor}
              >
                <text fg={testResult()?.success ? successColor : errorColor}>
                  {testResult()?.success ? "✓ " : "✗ "}
                  {testResult()?.message}
                </text>
              </box>
            </Show>
            
            {/* Buttons */}
            <box flexDirection="row" gap={1} marginTop={1}>
              <box
                paddingLeft={2} paddingRight={2}
                borderStyle="single"
                borderColor={theme.border}
                onMouseUp={() => setStep("auth")}
              >
                <text fg={theme.textMuted}>Back</text>
              </box>
              
              <Show when={testResult()?.success}>
                <box
                  paddingLeft={2} paddingRight={2}
                  borderStyle="single"
                  borderColor={successColor}
                  backgroundColor={successColor}
                  onMouseUp={handleSave}
                >
                  <text fg={RGBA.fromInts(255, 255, 255)}>Save Provider</text>
                </box>
              </Show>
            </box>
          </box>
        </Match>
      </Switch>
    </box>
  )
}
