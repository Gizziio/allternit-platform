import React from "react";

interface AllternitWordmarkProps {
  variant?: "light" | "dark";
  height?: number;
  className?: string;
}

export function AllternitWordmark({
  variant = "light",
  height = 28,
  className,
}: AllternitWordmarkProps) {
  const src =
    variant === "light"
      ? "/brand/allternit-wordmark-light.svg"
      : "/brand/allternit-wordmark.svg";

  return (
    <img
      src={src}
      alt="Allternit"
      height={height}
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}
