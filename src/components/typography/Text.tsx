import * as React from "react";

type TextVariant =
  | "display" | "heading" | "subheading" | "body" | "caption" | "label"
  | "researchDisplay" | "researchHeading" | "researchBody" | "researchMeta"
  | "code" | "agentLog" | "protocol";

const variantClass: Record<TextVariant, string> = {
  display: "text-display",
  heading: "text-heading",
  subheading: "text-subheading",
  body: "text-body",
  caption: "text-caption",
  label: "text-label",
  researchDisplay: "research-display",
  researchHeading: "research-heading",
  researchBody: "research-body",
  researchMeta: "research-meta",
  code: "text-code",
  agentLog: "agent-log",
  protocol: "protocol-token",
};

type TextProps = {
  as?: keyof JSX.IntrinsicElements;
  variant?: TextVariant;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>;

export function Text({ as = "span", variant = "body", className = "", children, ...props }: TextProps) {
  const Component = as as React.ElementType;
  return <Component className={`${variantClass[variant]} ${className}`.trim()} {...props}>{children}</Component>;
}
