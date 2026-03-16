"use client"

import { Button } from "../ui/button"
import { cn } from "../../lib/utils"
import { ArrowDown } from "@phosphor-icons/react"
import { useStickToBottomContext } from "use-stick-to-bottom"
import React from "react"

export type ScrollButtonProps = {
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>

function ScrollButton({
  className,
  ...props
}: ScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        "h-10 w-10 rounded-full transition-all duration-150 ease-out shadow-lg bg-[var(--bg-secondary)] border-[var(--border-subtle)]",
        !isAtBottom
          ? "translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-4 scale-95 opacity-0",
        className
      )}
      onClick={() => scrollToBottom()}
      {...props}
    >
      <ArrowDown className="h-5 w-5" />
    </Button>
  )
}

export { ScrollButton }
