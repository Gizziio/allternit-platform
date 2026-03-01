import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntimeExecutionMode } from "./useRuntimeExecutionMode";
import { runtimeApi } from "@/lib/agents/native-agent-api";

vi.mock("@/lib/agents/native-agent-api", () => ({
  runtimeApi: {
    getExecutionMode: vi.fn(),
    setExecutionMode: vi.fn(),
  },
}));

describe("useRuntimeExecutionMode", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(runtimeApi.getExecutionMode).mockResolvedValue({
      mode: "safe",
      updated_at: "2026-02-27T16:30:00.000Z",
      supported_modes: ["plan", "safe", "auto"],
    });
  });

  it("loads the shared runtime execution mode on mount", async () => {
    const { result } = renderHook(() => useRuntimeExecutionMode());

    await waitFor(() => {
      expect(result.current.executionMode?.mode).toBe("safe");
    });

    expect(runtimeApi.getExecutionMode).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });

  it("updates the shared runtime execution mode", async () => {
    vi.mocked(runtimeApi.setExecutionMode).mockResolvedValue({
      mode: "plan",
      updated_at: "2026-02-27T16:31:00.000Z",
      supported_modes: ["plan", "safe", "auto"],
    });

    const { result } = renderHook(() => useRuntimeExecutionMode());

    await waitFor(() => {
      expect(result.current.executionMode?.mode).toBe("safe");
    });

    await act(async () => {
      await result.current.setMode("plan");
    });

    expect(runtimeApi.setExecutionMode).toHaveBeenCalledWith("plan");
    expect(result.current.executionMode?.mode).toBe("plan");
  });

  it("surfaces execution mode fetch failures", async () => {
    vi.mocked(runtimeApi.getExecutionMode).mockRejectedValueOnce(
      new Error("network down"),
    );

    const { result } = renderHook(() => useRuntimeExecutionMode());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error?.message).toBe("network down");
    expect(result.current.executionMode).toBeNull();
  });
});
