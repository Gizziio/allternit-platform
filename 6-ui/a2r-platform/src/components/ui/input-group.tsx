import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const InputGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col rounded-md border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring",
      className
    )}
    {...props}
  />
))
InputGroup.displayName = "InputGroup"

export { InputGroup }

// Additional exports for AI Elements compatibility
export interface InputGroupAddonProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "block-start" | "block-end" | "center";
}

export const InputGroupAddon = React.forwardRef<
  HTMLDivElement,
  InputGroupAddonProps
>(({ className, align, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center gap-1 px-3 py-2",
      align === "block-start" && "items-start order-first border-b border-input",
      align === "block-end" && "items-end order-last border-t border-input justify-between",
      align === "center" && "items-center",
      className
    )}
    {...props}
  />
))
InputGroupAddon.displayName = "InputGroupAddon"

const inputGroupButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface InputGroupButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof inputGroupButtonVariants> {
  asChild?: boolean
}

export const InputGroupButton = React.forwardRef<HTMLButtonElement, InputGroupButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        ref={ref}
        className={cn(inputGroupButtonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
InputGroupButton.displayName = "InputGroupButton"

export const InputGroupTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn("w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground resize-none min-h-[60px]", className)}
    {...props}
  />
))
InputGroupTextarea.displayName = "InputGroupTextarea"

export const InputGroupInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn("flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground", className)}
    {...props}
  />
))
InputGroupInput.displayName = "InputGroupInput"

export const InputGroupText = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
InputGroupText.displayName = "InputGroupText"
