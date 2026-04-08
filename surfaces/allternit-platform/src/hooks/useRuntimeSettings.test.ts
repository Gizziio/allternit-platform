import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntimeSettings } from "./useRuntimeSettings";

const settingsPayload = {
  driver: {
    driver_type: "process",
    isolation_level: "limited",
    enabled: true,
  },
  resources: {
    cpu_millicores: 1000,
    memory_mib: 2048,
    budget_credits_per_hour: 10,
  },
  replay: {
    capture_level: "minimal",
    deterministic_mode: true,
    snapshot_interval_seconds: 60,
  },
  prewarm: {
    enabled: true,
    pool_size: 2,
    warmup_commands: ["echo prewarm"],
  },
  versioning: {
    auto_commit: false,
    commit_message_template: "[allternit] {description}",
    branch_prefix: "allternit-session-",
  },
};

const driversPayload = [
  {
    driver_type: "process",
    name: "Process Driver",
    description: "OS process execution",
    isolation: "limited",
    available: true,
    recommended: false,
    max_resources: {
      cpu_millicores: 8000,
      memory_mib: 32768,
      budget_credits_per_hour: null,
    },
  },
  {
    driver_type: "microvm",
    name: "MicroVM Driver",
    description: "MicroVM execution",
    isolation: "maximum",
    available: false,
    recommended: true,
    max_resources: {
      cpu_millicores: 8000,
      memory_mib: 32768,
      budget_credits_per_hour: null,
    },
  },
];

const driverStatuses = {
  process: {
    driver_type: "process",
    status: "healthy",
    active_instances: 1,
    pool_size: 0,
    healthy: true,
    message: null,
  },
  microvm: {
    driver_type: "microvm",
    status: "unavailable",
    active_instances: 0,
    pool_size: 0,
    healthy: false,
    message: "Driver not registered",
  },
};

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    json: async () => data,
  } as Response;
}

describe("useRuntimeSettings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/api/v1/runtime/settings/reset")) {
          return jsonResponse(settingsPayload);
        }

        if (url.endsWith("/api/v1/runtime/settings") && init?.method === "PUT") {
          return jsonResponse(settingsPayload);
        }

        if (url.endsWith("/api/v1/runtime/settings")) {
          return jsonResponse(settingsPayload);
        }

        if (url.endsWith("/api/v1/runtime/drivers")) {
          return jsonResponse(driversPayload);
        }

        if (url.endsWith("/process/status")) {
          return jsonResponse(driverStatuses.process);
        }

        if (url.endsWith("/microvm/status")) {
          return jsonResponse(driverStatuses.microvm);
        }

        if (url.endsWith("/process/activate")) {
          return jsonResponse({
            status: "activated",
            driver: "process",
            isolation: "limited",
          });
        }

        throw new Error(`Unhandled fetch: ${url}`);
      }),
    );
  });

  it("loads runtime settings and driver status", async () => {
    const { result } = renderHook(() => useRuntimeSettings());

    await waitFor(() => {
      expect(result.current.settings?.driver.driver_type).toBe("process");
    });

    expect(result.current.drivers).toHaveLength(2);
    expect(result.current.drivers[0]?.isActive).toBe(true);
    expect(result.current.drivers[0]?.statusInfo?.status).toBe("healthy");
  });

  it("updates runtime settings", async () => {
    const { result } = renderHook(() => useRuntimeSettings());

    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    await act(async () => {
      await result.current.updateSettings({
        resources: {
          cpu_millicores: 2000,
          memory_mib: 4096,
          budget_credits_per_hour: 10,
        },
      });
    });

    expect(fetch).toHaveBeenCalledWith("/api/v1/runtime/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resources: {
          cpu_millicores: 2000,
          memory_mib: 4096,
          budget_credits_per_hour: 10,
        },
      }),
    });
  });

  it("activates a driver and refetches settings", async () => {
    const { result } = renderHook(() => useRuntimeSettings());

    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    await act(async () => {
      await result.current.activateDriver("process");
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/runtime/drivers/process/activate",
      {
        method: "POST",
      },
    );
  });

  it("resets runtime settings", async () => {
    const { result } = renderHook(() => useRuntimeSettings());

    await waitFor(() => {
      expect(result.current.settings).not.toBeNull();
    });

    await act(async () => {
      await result.current.resetSettings();
    });

    expect(fetch).toHaveBeenCalledWith("/api/v1/runtime/settings/reset", {
      method: "POST",
    });
  });
});
