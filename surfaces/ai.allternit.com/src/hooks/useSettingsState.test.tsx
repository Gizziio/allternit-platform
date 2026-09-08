import { act, renderHook } from "@testing-library/react";
import { useSettingsState, useSettingsValue } from "./useSettingsState";

const PREFIX = "allternit.settings.v1.";
const CHANGED_EVENT = "allternit:setting-changed";

// vitest.setup.ts replaces localStorage with a no-op stub (getItem always
// null); install a working in-memory store so persistence paths are exercised.
function installLocalStorage() {
  let store: Record<string, string> = {};
  const storage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
  Object.defineProperty(window, "localStorage", { value: storage, writable: true });
  return storage;
}

function countSettingChangedEvents(key: string) {
  let count = 0;
  const listener = (event: Event) => {
    if ((event as CustomEvent).detail?.key === key) count++;
  };
  window.addEventListener(CHANGED_EVENT, listener);
  return {
    count: () => count,
    stop: () => window.removeEventListener(CHANGED_EVENT, listener),
  };
}

describe("useSettingsState / useSettingsValue", () => {
  beforeEach(() => {
    installLocalStorage().clear();
  });

  it("does not storm events when a mounted reader's key is written with an unchanged value", () => {
    // Reader mounted, like any component subscribed to the key.
    const reader = renderHook(() => useSettingsValue("crashtest.key", "a"));
    expect(reader.result.current[0]).toBe("a");

    const events = countSettingChangedEvents("crashtest.key");

    // Writer fires from OUTSIDE the reader AND outside React batching — the
    // runtime-settings-writer path. Before the no-op guard, a same-value write
    // dispatched `setting-changed`, the reader's reread called the writer
    // again, and the chain looped (~2000 dispatches per write in tests, an
    // uncaught RangeError stack overflow in production).
    const writer = renderHook(() => useSettingsState<string>("crashtest.key", "a"));
    expect(() => {
      writer.result.current[1]("a");
    }).not.toThrow();

    // No-op write: no event, no storage write, reader settles on the same value.
    expect(events.count()).toBe(0);
    events.stop();
    expect(window.localStorage.getItem(PREFIX + "crashtest.key")).toBeNull();
    expect(reader.result.current[0]).toBe("a");
  });

  it("propagates an actual change to a mounted reader exactly once", () => {
    const reader = renderHook(() => useSettingsValue("crashtest.key", "a"));
    const writer = renderHook(() => useSettingsState<string>("crashtest.key", "a"));
    const events = countSettingChangedEvents("crashtest.key");

    act(() => {
      writer.result.current[1]("b");
    });

    expect(reader.result.current[0]).toBe("b");
    expect(window.localStorage.getItem(PREFIX + "crashtest.key")).toBe(JSON.stringify("b"));
    // Writer dispatch + reader reread re-dispatch, then the guards stop the chain.
    expect(events.count()).toBeLessThanOrEqual(2);
    events.stop();
  });

  it("reader picks up writes made directly via localStorage + manual event", () => {
    const reader = renderHook(() => useSettingsValue("crashtest.key", "a"));

    act(() => {
      window.localStorage.setItem(PREFIX + "crashtest.key", JSON.stringify("z"));
      window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { key: "crashtest.key" } }));
    });

    expect(reader.result.current[0]).toBe("z");
  });
});
