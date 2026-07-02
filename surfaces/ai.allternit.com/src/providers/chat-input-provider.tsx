"use client";

import React, {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Attachment, UiToolName } from "@/lib/ai/types";

interface ChatInputContextType {
  inputValue: string;
  setInputValue: (value: string) => void;
  selectedTool: UiToolName;
  setSelectedTool: Dispatch<SetStateAction<UiToolName>>;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  selectedModelId: string;
  setSelectedModelId: (modelId: string) => void;
  isEmpty: boolean;
  handleSubmit: (submitFn: () => void) => void;
  isProjectContext: boolean;
  clearInput: () => void;
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (id: string) => void;
}

const ChatInputContext = createContext<ChatInputContextType | undefined>(undefined);

interface ChatInputProviderProps {
  children: ReactNode;
  initialInput?: string;
  initialTool?: UiToolName;
  initialAttachments?: Attachment[];
  defaultModelId?: string;
  localStorageEnabled?: boolean;
  isProjectContext?: boolean;
}

export function ChatInputProvider({
  children,
  initialInput = "",
  initialTool = null,
  initialAttachments = [],
  defaultModelId = "kimi/kimi-for-coding",
  localStorageEnabled = true,
  isProjectContext = false,
}: ChatInputProviderProps) {
  const [inputValue, setInputValue] = useState(() => {
    if (typeof window !== 'undefined' && localStorageEnabled) {
      try {
        const saved = localStorage.getItem("allternit:input");
        if (saved && !initialInput) return saved;
      } catch {
        // ignore
      }
    }
    return initialInput || "";
  });
  const [selectedTool, setSelectedTool] = useState<UiToolName>(initialTool);
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [selectedModelId, setSelectedModelId] = useState(defaultModelId);

  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!localStorageEnabled || !hasHydrated) return;
    
    try {
      localStorage.setItem("allternit:input", inputValue);
    } catch {
      // Ignore localStorage errors
    }
  }, [inputValue, localStorageEnabled]);

  const isEmpty = inputValue.trim().length === 0 && attachments.length === 0;

  const clearInput = useCallback(() => {
    setInputValue("");
    setAttachments([]);
    setSelectedTool(null);
    setSelectedModelId(defaultModelId);
    if (localStorageEnabled) {
      localStorage.removeItem("allternit:input");
    }
  }, [localStorageEnabled, defaultModelId]);

  const handleSubmit = useCallback(
    (submitFn: () => void) => {
      submitFn();
      clearInput();
    },
    [clearInput]
  );

  const addAttachment = useCallback((attachment: Attachment) => {
    setAttachments((prev) => [...prev, attachment]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return (
    <ChatInputContext.Provider
      value={{
        inputValue,
        setInputValue,
        selectedTool,
        setSelectedTool,
        attachments,
        setAttachments,
        selectedModelId,
        setSelectedModelId,
        isEmpty,
        handleSubmit,
        isProjectContext,
        clearInput,
        addAttachment,
        removeAttachment,
      }}
    >
      {children}
    </ChatInputContext.Provider>
  );
}

function useChatInput() {
  const context = useContext(ChatInputContext);
  if (context === undefined) {
    throw new Error("useChatInput must be used within a ChatInputProvider");
  }
  return context;
}
