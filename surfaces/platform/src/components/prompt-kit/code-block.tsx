
"use client"

import { cn } from "../../lib/utils"
import React from "react"
import { SyntaxHighlighter } from "@/views/plugins/SyntaxHighlighter"

export type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip border",
        "border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type CodeBlockCodeProps = {
  code: string
  language?: string
  theme?: string
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlockCode({
  code,
  language = "tsx",
  theme = "github-dark", // Use a neutral default
  className,
  ...props
}: CodeBlockCodeProps) {
  void theme

  const classNames = cn(
    "w-full overflow-x-auto text-[13px] [&>pre]:px-4 [&>pre]:py-4 font-mono",
    className
  )

  return (
    <div className={classNames} {...props}>
      <SyntaxHighlighter code={code} language={language} showLineNumbers={false} />
    </div>
  )
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock }
