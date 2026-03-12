/**
 * Onboarding Wizard - Mode Selection Step
 * 
 * Added: Mode selection (Code vs Cowork)
 * Position: After theme selection, before account setup
 */

import { createSignal } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { ModeSwitcher, type AppMode } from "./mode-switcher"
import { RGBA, TextAttributes } from "@opentui/core"

interface OnboardingModeSelectionProps {
  onComplete: (mode: AppMode) => void
  onBack: () => void
}

export function OnboardingModeSelection(props: OnboardingModeSelectionProps) {
  const { theme } = useTheme()
  const [selectedMode, setSelectedMode] = createSignal<AppMode>("code")
  const [step, setStep] = createSignal<0 | 1>(0) // 0 = select, 1 = confirm
  
  const accent = RGBA.fromInts(167, 139, 250) // Purple accent
  
  function handleContinue() {
    if (step() === 0) {
      setStep(1)
    } else {
      props.onComplete(selectedMode())
    }
  }
  
  return (
    <box
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      flexGrow={1}
      gap={2}
    >
      {/* Header */}
      <box flexDirection="column" alignItems="center" gap={1}>
        <text fg={accent} attributes={TextAttributes.BOLD} style={{ fontSize: 1.5 }}>
          Choose Your Mode
        </text>
        <text fg={theme.textMuted} textAlign="center">
          Select your preferred working environment
        </text>
      </box>
      
      <box height={1} />
      
      {/* Mode Selection */}
      <box
        borderStyle="single"
        borderColor={theme.border}
        padding={2}
        gap={2}
        flexDirection="column"
      >
        {/* Mode Switcher Preview */}
        <box justifyContent="center">
          <ModeSwitcher
            activeMode={selectedMode()}
            onModeChange={setSelectedMode}
            size="large"
            showLabels={true}
          />
        </box>
        
        <box height={1} />
        
        {/* Mode Description */}
        <box padding={1} backgroundColor={RGBA.fromInts(0, 0, 0, 64)}>
          {selectedMode() === "code" ? (
            <box flexDirection="column" gap={1}>
              <text fg={RGBA.fromInts(107, 154, 123)} attributes={TextAttributes.BOLD}>
                💻 Code Mode
              </text>
              <text fg={theme.text} wrap="wrap">
                Traditional terminal coding experience. Perfect for developers who want
                a clean, focused environment for writing and running code.
              </text>
              <box height={1} />
              <text fg={theme.textMuted} style={{ fontSize: 0.9 }}>
                ✓ Standard terminal interface
              </text>
              <text fg={theme.textMuted} style={{ fontSize: 0.9 }}>
                ✓ Code editing and execution
              </text>
              <text fg={theme.textMuted} style={{ fontSize: 0.9 }}>
                ✓ Agent can be toggled on/off
              </text>
            </box>
          ) : (
            <box flexDirection="column" gap={1}>
              <text fg={RGBA.fromInts(154, 123, 170)} attributes={TextAttributes.BOLD}>
                🤝 Cowork Mode
              </text>
              <text fg={theme.text} wrap="wrap">
                Collaborative workspace with dynamic viewport. See browser previews,
                artifacts, and rich content alongside your terminal.
              </text>
              <box height={1} />
              <text fg={theme.textMuted} style={{ fontSize: 0.9 }}>
                ✓ Dynamic computer viewport (right side)
              </text>
              <text fg={theme.textMuted} style={{ fontSize: 0.9 }}>
                ✓ Browser previews and web content
              </text>
              <text fg={theme.textMuted} style={{ fontSize: 0.9 }}>
                ✓ Artifacts, images, and media display
              </text>
              <text fg={theme.textMuted} style={{ fontSize: 0.9 }}>
                ✓ Agent can be toggled on/off
              </text>
            </box>
          )}
        </box>
      </box>
      
      {/* Navigation */}
      <box flexDirection="row" gap={2}>
        <box
          onMouseUp={props.onBack}
          padding={1}
          paddingLeft={2}
          paddingRight={2}
          borderStyle="single"
          borderColor={theme.border}
          cursor="pointer"
        >
          <text fg={theme.text}>← Back</text>
        </box>
        
        <box
          onMouseUp={handleContinue}
          padding={1}
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={step() === 0 ? theme.border : accent}
          borderStyle="single"
          borderColor={step() === 0 ? theme.border : accent}
          cursor="pointer"
        >
          <text fg={step() === 0 ? theme.text : RGBA.fromInts(255, 255, 255)}>
            {step() === 0 ? "Continue" : "Confirm →"}
          </text>
        </box>
      </box>
      
      {/* Step indicator */}
      <box flexDirection="row" gap={1} paddingTop={1}>
        <box width={step() === 0 ? 2 : 1} height={1} backgroundColor={accent} />
        <box width={step() === 1 ? 2 : 1} height={1} backgroundColor={theme.border} />
      </box>
    </box>
  )
}
