
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip"
import * as Popover from "@radix-ui/react-popover";
import { cn } from "../../lib/utils"
import { Markdown } from "./markdown"
import React from "react"
import { 
    Copy, 
    Volume2, 
    ThumbsUp, 
    ThumbsDown, 
    MoreHorizontal, 
    RefreshCw, 
    GitBranch, 
    Zap,
    ChevronRight,
    Volume2 as SpeakerHigh,
    RefreshCw as ArrowsClockwise
} from "lucide-react"

export type MessageProps = {
  children: React.ReactNode
  role: "user" | "assistant" | "system"
  modelName?: string
  className?: string
  onAction?: (action: string, data?: any) => void
} & React.HTMLProps<HTMLDivElement>

const Message = ({ children, role, modelName, className, onAction, ...props }: MessageProps) => {
  const isUser = role === "user"
  const isAssistant = role === "assistant"

  return (
    <div className={cn("group flex gap-4 w-full px-4 py-2", isUser ? "flex-row-reverse" : "flex-row", className)} {...props}>
      <MessageAvatar 
        fallback={isUser ? "U" : "AI"}
        className={isUser ? "bg-[var(--accent-chat)] text-white" : "bg-[var(--bg-secondary)] text-[var(--accent-chat)]"}
      />
      <div className={cn("flex flex-col gap-1 min-w-0 max-w-[85%]", isUser && "items-end")}>
        <MessageContent markdown={typeof children === "string"} isUser={isUser}>
          {children}
        </MessageContent>
        
        {isAssistant && (
            <div className="flex items-center gap-3 mt-1 px-1">
                {modelName && (
                    <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-tight bg-[var(--rail-hover)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                        {modelName}
                    </span>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <ActionButton icon={Copy} tooltip="Copy" onClick={() => onAction?.("copy")} />
                    <ActionButton icon={Volume2} tooltip="Speak" onClick={() => onAction?.("speak")} />
                    <div className="w-px h-3 bg-[var(--border-subtle)] mx-1" />
                    <ActionButton icon={ThumbsUp} tooltip="Helpful" onClick={() => onAction?.("rate-up")} />
                    <ActionButton icon={ThumbsDown} tooltip="Not helpful" onClick={() => onAction?.("rate-down")} />
                    <div className="w-px h-3 bg-[var(--border-subtle)] mx-1" />
                    <MessageEllipsisMenu onAction={onAction} />
                </div>
            </div>
        )}
      </div>
    </div>
  )
}

function ActionButton({ icon: Icon, tooltip, onClick }: any) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button onClick={onClick} className="p-1 rounded hover:bg-[var(--rail-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
                        <Icon size={14} />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{tooltip}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

function MessageEllipsisMenu({ onAction }: any) {
    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button className="p-1 rounded hover:bg-[var(--rail-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                    <MoreHorizontal size={16} strokeWidth={2.5} />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content side="top" align="center" sideOffset={8} className="w-[200px] rounded-xl bg-[var(--glass-bg-thick)] backdrop-blur-xl border border-[var(--border-subtle)] shadow-xl p-1 z-50">
                    <MenuEntry icon={GitBranch} label="Branch Session" onClick={() => onAction?.("branch")} />
                    <div className="h-px bg-[var(--border-subtle)] my-1" />
                    <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Retry with Mode</div>
                    <MenuEntry label="Think Hard" onClick={() => onAction?.("retry-hard")} />
                    <MenuEntry label="Think Harder" onClick={() => onAction?.("retry-harder")} />
                    <MenuEntry label="Ultra Think" onClick={() => onAction?.("retry-ultra")} />
                    <div className="h-px bg-[var(--border-subtle)] my-1" />
                    <MenuEntry icon={RefreshCw} label="Switch Model & Retry" onClick={() => onAction?.("retry-switch")} />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    )
}

function MenuEntry({ icon: Icon, label, onClick }: any) {
    return (
        <button onClick={onClick} className="flex w-full items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--rail-hover)] hover:text-[var(--text-primary)] transition-colors text-left">
            {Icon && <Icon size={14} />}
            <span className="flex-1">{label}</span>
        </button>
    )
}

export type MessageAvatarProps = {
  src?: string
  alt?: string
  fallback?: React.ReactNode
  className?: string
}

const MessageAvatar = ({
  src,
  alt = "Avatar",
  fallback,
  className,
}: MessageAvatarProps) => {
  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      {src && <AvatarImage src={src} alt={alt} />}
      <AvatarFallback className="text-[10px] font-bold">{fallback}</AvatarFallback>
    </Avatar>
  )
}

export type MessageContentProps = {
  children: React.ReactNode
  markdown?: boolean
  isUser?: boolean
  className?: string
}

const MessageContent = ({
  children,
  markdown = false,
  isUser = false,
  className,
}: MessageContentProps) => {
  return (
    <div className={cn(
        "rounded-2xl px-4 py-2.5 min-w-0 shadow-sm transition-all",
        isUser ? "bg-[var(--accent-chat)] text-white rounded-tr-sm" : "bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-tl-sm border border-[var(--border-subtle)]",
        className
    )}>
      {markdown ? (
        <Markdown className={isUser ? "text-white prose-p:text-white prose-headings:text-white prose-strong:text-white prose-code:text-white prose-code:bg-white/20" : ""}>
            {children as string}
        </Markdown>
      ) : (
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{children}</div>
      )}
    </div>
  )
}

export { Message, MessageAvatar, MessageContent }
