import { ThinkingOrb, type OrbState } from "thinking-orbs";

import { cn } from "@/lib/utils"

function Spinner({
  className,
  state = "working",
  ...props
}: React.ComponentProps<"canvas"> & { state?: OrbState }) {
  return (
    <ThinkingOrb
      state={state}
      size={20}
      role="status"
      aria-label="Loading"
      className={cn("inline-block align-middle", className)}
      {...props}
    />
  )
}

export { Spinner }
