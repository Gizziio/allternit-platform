"use client";

/**
 * Model Picker Integration Example
 * 
 * This shows how to integrate the 2-layer ModelPicker into the Chat UI.
 * 
 * Usage:
 * 1. Wrap your app with ModelSelectionProvider
 * 2. Use ModelPicker to select runtime + model
 * 3. Use useModelSelection to get the config for creating brain sessions
 */

import { useModelSelection } from "@/providers/model-selection-provider";
import { ModelPicker, type ModelSelection } from "@/components/model-picker";
import { api } from "@/integration/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CircleNotch,
  Sparkle,
  X,
} from '@phosphor-icons/react';
import { useState, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// Example 1: Simple Model Selector Button
// ═══════════════════════════════════════════════════════════════════════════════

export function ModelSelectorButton() {
  const { selection, clearSelection } = useModelSelection();

  if (selection) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Sparkle size={12} />
          {selection.modelName || selection.modelId}
        </Badge>
        <Button variant="ghost" size="sm" onClick={clearSelection}>
          <X size={12} />
        </Button>
      </div>
    );
  }

  return (
    <ModelPicker 
      onSelect={(sel) => console.log("Selected:", sel)}
      trigger={
        <Button variant="outline" size="sm" className="gap-1">
          <Sparkle size={12} />
          Select Model
        </Button>
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Example 2: Chat Input with Model Selection
// ═══════════════════════════════════════════════════════════════════════════════

interface ChatInputWithModelProps {
  onSend: (message: string, modelConfig?: {
    brain_profile_id: string;
    source: "chat";
    runtime_overrides?: { model_id: string };
  }) => void;
  disabled?: boolean;
}

export function ChatInputWithModel({ onSend, disabled }: ChatInputWithModelProps) {
  const [message, setMessage] = useState("");
  const { selection, getBrainSessionConfig, clearSelection } = useModelSelection();
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const handleSend = useCallback(async () => {
    if (!message.trim()) return;

    const config = getBrainSessionConfig();
    
    // If we have a model selection, create a brain session
    if (config) {
      setIsCreatingSession(true);
      try {
        const session = await api.createBrainSession(
          config.brain_profile_id,
          config.source,
          config.runtime_overrides
        );
        console.log("Brain session created:", session);
        
        // Send message to the brain session
        await api.sendMessage(session.id, message);
        
        onSend(message, config);
        setMessage("");
        clearSelection();
      } catch (error) {
        console.error("Failed to create brain session:", error);
      } finally {
        setIsCreatingSession(false);
      }
    } else {
      // No model selected - use default chat
      onSend(message);
      setMessage("");
    }
  }, [message, getBrainSessionConfig, onSend, clearSelection]);

  return (
    <div className="flex flex-col gap-2">
      {/* Selected Model Display */}
      {selection && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
          <Sparkle className="h-4 w-4 text-primary" />
          <span className="text-sm">
            Using <strong>{selection.modelName || selection.modelId}</strong>
            {" "}via {selection.profileId}
          </span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-auto py-1 px-2 ml-auto"
            onClick={clearSelection}
          >
            <X size={12} />
          </Button>
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 min-h-[60px] p-3 rounded-lg border bg-background resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={disabled || isCreatingSession}
        />
        
        <div className="flex flex-col gap-2">
          {!selection && (
            <ModelPicker
              onSelect={(sel) => console.log("Selected:", sel)}
              trigger={
                <Button variant="outline" size="icon">
                  <Sparkle size={16} />
                </Button>
              }
            />
          )}
          
          <Button 
            onClick={handleSend}
            disabled={!message.trim() || disabled || isCreatingSession}
            className="h-10"
          >
            {isCreatingSession ? (
              <CircleNotch className="h-4 w-4 animate-spin" />
            ) : (
              "Send"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Example 3: Session Creation with Model Override
// ═══════════════════════════════════════════════════════════════════════════════

export async function createChatWithModel(selection: ModelSelection) {
  // Create brain session with runtime_overrides
  const session = await api.createBrainSession(
    selection.profileId,
    "chat", // source must be "chat" for chat UI
    { model_id: selection.modelId }
  );

  console.log("Created session:", {
    sessionId: session.id,
    profileId: selection.profileId,
    modelId: selection.modelId,
  });

  return session;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Example 4: Direct API Usage (without React)
// ═══════════════════════════════════════════════════════════════════════════════

export async function selectModelAndCreateSession() {
  // Step 1: List authenticated providers
  const { providers } = await api.listProviderAuthStatus();
  const authenticated = providers.filter(p => p.authenticated);
  
  console.log("Available providers:", authenticated);

  // Step 2: For a provider, discover models
  const providerId = "kimi"; // or "opencode", "claude", etc.
  const discovery = await api.discoverProviderModels(providerId);
  
  console.log("Model discovery:", discovery);

  // Step 3: Validate the model ID
  const modelId = "kimi-k2";
  const validation = await api.validateProviderModel(providerId, modelId);
  
  console.log("Validation:", validation);

  // Step 4: Create session with model
  if (validation.valid) {
    const chatProfileId = authenticated
      .find(p => p.provider_id === providerId)
      ?.chat_profile_ids[0];

    if (chatProfileId) {
      const session = await api.createBrainSession(
        chatProfileId,
        "chat",
        { model_id: modelId }
      );
      
      return session;
    }
  }

  throw new Error("Failed to create session");
}

// ═══════════════════════════════════════════════════════════════════════════════
// Usage in App
// ═══════════════════════════════════════════════════════════════════════════════

/*

1. Wrap your app with the provider:

import { ModelSelectionProvider } from "@/providers/model-selection-provider";

function App() {
  return (
    <ModelSelectionProvider>
      <ChatUI />
    </ModelSelectionProvider>
  );
}

2. Use the ModelPicker in your chat input:

import { ChatInputWithModel } from "@/components/model-picker-example";

function ChatUI() {
  const handleSend = (message: string, config?: {...}) => {
    console.log("Sending:", message, "with config:", config);
  };

  return (
    <div>
      <ChatInputWithModel onSend={handleSend} />
    </div>
  );
}

*/
