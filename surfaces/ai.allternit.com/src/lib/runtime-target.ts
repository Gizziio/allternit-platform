"use client";

export type RuntimeExecutionTarget = "local" | "cloud";

export const ACTIVE_RUNTIME_ID_KEY = "allternit.active-runtime-id";
export const RUNTIME_EXECUTION_TARGET_KEY = "allternit.runtime-execution-target";
export const RUNTIME_TARGET_CHANGED_EVENT = "allternit:runtime-target-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function defaultTarget(): RuntimeExecutionTarget {
  if (!isBrowser()) return "local";
  const isDesktop = Boolean(window.allternitSidecar);
  const isLoopback = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  return isDesktop || isLoopback ? "local" : "cloud";
}

export function getRuntimeExecutionTarget(): RuntimeExecutionTarget {
  if (!isBrowser()) return "local";
  const stored = window.localStorage.getItem(RUNTIME_EXECUTION_TARGET_KEY);
  return stored === "local" || stored === "cloud" ? stored : defaultTarget();
}

export function getActiveRuntimeId(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACTIVE_RUNTIME_ID_KEY);
}

export function setRuntimeExecutionTarget(
  target: RuntimeExecutionTarget,
  runtimeId?: string | null,
): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(RUNTIME_EXECUTION_TARGET_KEY, target);
  if (runtimeId) window.localStorage.setItem(ACTIVE_RUNTIME_ID_KEY, runtimeId);
  window.dispatchEvent(new CustomEvent(RUNTIME_TARGET_CHANGED_EVENT, {
    detail: { target, runtimeId: getActiveRuntimeId() },
  }));
}

export function subscribeRuntimeExecutionTarget(listener: () => void): () => void {
  if (!isBrowser()) return () => {};
  window.addEventListener(RUNTIME_TARGET_CHANGED_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(RUNTIME_TARGET_CHANGED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
