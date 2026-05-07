"use client"

import { Textarea } from "../ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip"
import { cn } from "../../lib/utils"
import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Paperclip, Microphone, Stop, ArrowUp, X } from "@phosphor-icons/react"

// --- Types ---

export type AttachmentType = "file" | "photo" | "screenshot"
export type ChatMode = "standard" | "search" | "research" | "agent" | "temp"

type PromptInputContextType = {
  isLoading: boolean
  value: string
  setValue: (value: string) => void
  maxHeight: number | string
  onSubmit?: () => void
  onStop?: () => void
  disabled?: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement>
  activeModes: Set<ChatMode>
  toggleMode: (mode: ChatMode) => void
  onAttach: (type: AttachmentType) => void
  isRecording: boolean
  toggleRecording: () => void
  suggestion: string
  acceptSuggestion: () => void
}

const PromptInputContext = createContext<PromptInputContextType>({
  isLoading: false,
  value: "",
  setValue: () => {},
  maxHeight: 240,
  onSubmit: undefined,
  onStop: undefined,
  disabled: false,
  textareaRef: { current: null } as any,
  activeModes: new Set(),
  toggleMode: () => {},
  onAttach: () => {},
  isRecording: false,
  toggleRecording: () => {},
  suggestion: "",
  acceptSuggestion: () => {},
})

export function usePromptInput() {
  return useContext(PromptInputContext)
}

export type PromptInputProps = {
  isLoading?: boolean
  value?: string
  onValueChange?: (value: string) => void
  maxHeight?: number | string
  onSubmit?: () => void
  onStop?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
  onAttach?: (type: AttachmentType) => void
  onModeChange?: (modes: Set<ChatMode>) => void
} & React.ComponentProps<"div">

// --- Main Component ---

/**
 * PromptInput
 * Follows "Anatomy of AI Input" principles:
 * - Continuous usability
 * - Keyboard-first
 * - Discreet context grouping
 */
export function PromptInput({
  className,
  isLoading = false,
  maxHeight = 240,
  value,
  onValueChange,
  onSubmit,
  onStop,
  children,
  disabled = false,
  onAttach = () => {},
  onModeChange,
  ...props
}: PromptInputProps) {
  const [internalValue, setInternalValue] = useState(value || "")
  const [activeModes, setActiveModes] = useState<Set<ChatMode>>(new Set(["standard"]))
  const [isRecording, setIsRecording] = useState(false)
  const [suggestion, setSuggestion] = useState("")
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = (newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
    
    // Suggestion logic
    if (newValue.length > 2 && "explain this code".startsWith(newValue.toLowerCase())) {
        setSuggestion("explain this code")
    } else {
        setSuggestion("")
    }
  }

  const toggleMode = (mode: ChatMode) => {
    const newModes = new Set(activeModes)
    if (newModes.has(mode)) newModes.delete(mode)
    else newModes.add(mode)
    setActiveModes(newModes)
    onModeChange?.(newModes)
  }
  
  const toggleRecording = () => {
    setIsRecording(!isRecording)
  }

  const acceptSuggestion = () => {
    if (suggestion) {
        handleChange(suggestion)
        setSuggestion("")
    }
  }

  return (
    <TooltipProvider>
      <PromptInputContext.Provider
        value={{
          isLoading,
          value: value ?? internalValue,
          setValue: onValueChange ?? handleChange,
          maxHeight,
          onSubmit,
          onStop,
          disabled,
          textareaRef,
          activeModes,
          toggleMode,
          onAttach,
          isRecording,
          toggleRecording,
          suggestion,
          acceptSuggestion
        }}
      >
        <motion.div
          layout
          className={cn(
            "flex flex-col bg-[var(--glass-bg-thick)] border border-[var(--border-strong)] rounded-[24px] shadow-2xl transition-shadow focus-within:ring-1 focus-within:ring-[var(--accent-chat)] overflow-hidden",
            disabled && "opacity-60 pointer-events-none",
            isRecording && "ring-2 ring-red-500",
            className
          )}
          
        >
          {children}
        </motion.div>
      </PromptInputContext.Provider>
    </TooltipProvider>
  )
}

// --- Textarea with Auto-correct & Suggestions ---

export function PromptInputTextarea({
  className,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  const { value, setValue, maxHeight, onSubmit, disabled, textareaRef, suggestion, acceptSuggestion } =
    usePromptInput()

  useLayoutEffect(() => {
    if (!textareaRef.current) return
    const el = textareaRef.current
    el.style.height = "auto"
    const targetHeight = el.scrollHeight
    if (typeof maxHeight === "number") {
      el.style.height = Math.min(targetHeight, maxHeight) + "px"
    } else {
      el.style.height = "min(" + targetHeight + "px, " + maxHeight + ")"
    }
  }, [value, maxHeight, textareaRef])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      onSubmit?.()
    }
    if (e.key === "Tab" && suggestion) {
        e.preventDefault()
        acceptSuggestion()
    }
    onKeyDown?.(e)
  }

  return (
    <div className="relative w-full px-4 pt-4 pb-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn(
              "text-base md:text-sm leading-relaxed w-full resize-none border-none bg-transparent p-0 shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 relative z-10 placeholder:text-[var(--text-tertiary)]",
              className
          )}
          rows={1}
          disabled={disabled}
          
        />
        <AnimatePresence>
          {suggestion && value && suggestion.startsWith(value.toLowerCase()) && (
              <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  exit={{ opacity: 0 }}
                  className="absolute top-4 left-4 pointer-events-none z-0 select-none"
                  style={{ 
                      fontFamily: "inherit", 
                      fontSize: "inherit", 
                      lineHeight: "inherit",
                      whiteSpace: "pre-wrap"
                  }}
              >
                  <span className="invisible">{value}</span>
                  <span>{suggestion.slice(value.length)}</span>
                  <span className="ml-2 text-[10px] bg-[var(--rail-active-bg)] px-1 py-0.5 rounded border border-[var(--border-subtle)] text-[var(--text-secondary)]">TAB</span>
              </motion.div>
          )}
        </AnimatePresence>
    </div>
  )
}

// --- Action Bar (Context & Tools) ---

export function PromptInputActions({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { onAttach, toggleRecording, isRecording, isLoading, onSubmit, onStop, value } = usePromptInput()

  return (
    <div className={cn("flex items-center justify-between px-3 pb-3 gap-2", className)} >
      <div className="flex items-center gap-1.5">
        <PromptInputAction tooltip="Attach files" onClick={() => onAttach("file")}>
          <button aria-label="Attach files" className="p-2 hover:bg-[var(--rail-hover)] rounded-xl text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
            <Paperclip size={20} />
          </button>
        </PromptInputAction>
        
        <PromptInputAction tooltip={isRecording ? "Stop recording" : "Voice input"} onClick={toggleRecording}>
          <button aria-label="Voice input" className={cn(
            "p-2 hover:bg-[var(--rail-hover)] rounded-xl transition-all",
            isRecording ? "text-red-500 bg-red-500/10" : "text-[var(--text-tertiary)]"
          )}>
            <Microphone size={20} weight={isRecording ? "fill" : "regular"} />
          </button>
        </PromptInputAction>

        <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
        
        {children}
      </div>

      <div className="flex items-center gap-2">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.button
              key="stop"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={onStop}
              aria-label="Stop generation"
              className="flex items-center justify-center size-8 rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 transition-all shadow-sm"
            >
              <Stop size={16} weight="fill" />
            </motion.button>
          ) : (
            <motion.button
              key="send"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={onSubmit}
              disabled={!value.trim()}
              aria-label="Send message"
              className="flex items-center justify-center size-8 rounded-full bg-[var(--accent-chat)] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-sm"
            >
              <ArrowUp size={18} weight="bold" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export function PromptInputAction({
  tooltip,
  children,
  className,
  side = "top",
  active = false,
  onClick,
  ...props
}: {
  tooltip: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  active?: boolean
  onClick?: () => void
} & any) {
  const { disabled } = usePromptInput()

  return (
    <Tooltip>
      <TooltipTrigger
        asChild
        disabled={disabled}
        onClick={(e) => {
            e.stopPropagation();
            onClick?.();
        }}
      >
        <div className={cn("transition-colors", active && "text-[var(--accent-chat)]")}>
            {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
