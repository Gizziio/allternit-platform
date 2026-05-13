"use client";

import React, { useMemo, useSyncExternalStore } from "react";

type HydrationSafeTimeFormat = "date" | "datetime";

function formatUtcFallback(value: Date, format: HydrationSafeTimeFormat): string {
  const isoTimestamp = value.toISOString();
  return format === "datetime"
    ? `${isoTimestamp.replace("T", " ").slice(0, 19)} UTC`
    : isoTimestamp.slice(0, 10);
}

function formatLocalValue(value: Date, format: HydrationSafeTimeFormat): string {
  return format === "datetime" ? value.toLocaleString() : value.toLocaleDateString();
}

const emptySubscribe = () => () => {};

export function HydrationSafeTime({
  value,
  format = "datetime",
  className,
}: {
  value: number | string | Date;
  format?: HydrationSafeTimeFormat;
  className?: string;
}) {
  const date = useMemo(() => new Date(value), [value]);
  const isoTimestamp = date.toISOString();
  
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  return (
    <time className={className} dateTime={isoTimestamp} suppressHydrationWarning>
      {isClient ? formatLocalValue(date, format) : formatUtcFallback(date, format)}
    </time>
  );
}
