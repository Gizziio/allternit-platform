"use client";

import { useEffect, useState } from "react";

export function useLiveNow(intervalMs = 1000): JSX.Element {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();
    const intervalId = window.setInterval(updateNow, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [intervalMs]);

  return now;
}
