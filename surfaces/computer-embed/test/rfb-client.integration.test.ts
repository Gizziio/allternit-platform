/**
 * Integration test: the RFB client against a mock server implementing the
 * exact None-auth wire behavior of the Allternit VNC proxy. Runs headless in
 * Node via the `ws` package — the same RfbClient code the browser embed uses.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { RfbClient, bgrxToRgba, type RfbStatus } from "../src/rfb-client.js";
import { MemorySurface } from "../src/surface.js";
import { adaptNodeWebSocket } from "../src/websocket.js";
import { patternBgrx, startMockRfbServer, type MockRfbServer } from "./mock-rfb-server.js";

describe("RfbClient against mock RFB (None-auth) server", () => {
  let server: MockRfbServer;
  let client: RfbClient | null = null;
  const statuses: RfbStatus[] = [];
  const errors: string[] = [];

  beforeEach(async () => {
    statuses.length = 0;
    errors.length = 0;
    server = await startMockRfbServer({ width: 64, height: 48, name: "mock-rfb" });
  });

  afterEach(async () => {
    client?.disconnect();
    client = null;
    await server.close();
  });

  function connect(surface: MemorySurface): Promise<void> {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    client = new RfbClient({
      ws: adaptNodeWebSocket(ws as never),
      surface,
      onStatus: (status) => statuses.push(status),
      onError: (message) => errors.push(message),
    });
    return waitFor(() => statuses.includes("connected"), "client to connect");
  }

  it("completes the None-auth handshake and reaches connected state", async () => {
    const surface = new MemorySurface();
    await connect(surface);
    expect(errors).toEqual([]);
    expect(client!.serverName).toBe("mock-rfb");
    expect(surface.resizeCalls).toContainEqual({ width: 64, height: 48 });
  });

  it("renders a raw FramebufferUpdate to the surface", async () => {
    const surface = new MemorySurface();
    await connect(surface);
    await waitFor(() => surface.commitCount >= 1, "first framebuffer update");

    // Pattern is r=x, g=y, b=128 in RGBA after BGRX→RGBA conversion.
    expect(surface.pixelAt(0, 0)).toEqual([0, 0, 128, 255]);
    expect(surface.pixelAt(10, 5)).toEqual([10, 5, 128, 255]);
    expect(surface.pixelAt(63, 47)).toEqual([63, 47, 128, 255]);
  });

  it("decodes copyrect by copying source pixels to the destination", async () => {
    const surface = new MemorySurface();
    await connect(surface);
    await waitFor(() => surface.commitCount >= 1, "first framebuffer update");

    // The mock copies (0,0,16,12) → (20,20).
    expect(surface.pixelAt(20, 20)).toEqual([0, 0, 128, 255]);
    expect(surface.pixelAt(20 + 9, 20 + 4)).toEqual([9, 4, 128, 255]);
  });

  it("keeps receiving incremental updates and re-requests them", async () => {
    const surface = new MemorySurface();
    await connect(surface);
    await waitFor(() => surface.commitCount >= 2, "incremental framebuffer update");

    // The mock's incremental update is a 2x2 solid-blue rect at (5,5).
    expect(surface.pixelAt(5, 5)).toEqual([0, 0, 255, 255]);
    expect(surface.pixelAt(6, 6)).toEqual([0, 0, 255, 255]);
  });

  it("never sends input messages (KeyEvent/PointerEvent/ClientCutText)", async () => {
    const surface = new MemorySurface();
    await connect(surface);
    await waitFor(() => surface.commitCount >= 1, "first framebuffer update");

    // Allowed client→server types: 0 (SetPixelFormat), 2 (SetEncodings),
    // 3 (FramebufferUpdateRequest). Input is 4, 5, 6 — must never appear.
    expect(server.receivedTypes.length).toBeGreaterThan(0);
    for (const type of server.receivedTypes) {
      expect([0, 2, 3]).toContain(type);
    }
    expect(server.receivedTypes).toContain(0);
    expect(server.receivedTypes).toContain(2);
    expect(server.receivedTypes).toContain(3);
    expect(server.receivedTypes).not.toContain(4);
    expect(server.receivedTypes).not.toContain(5);
    expect(server.receivedTypes).not.toContain(6);
  });

  it("survives fragmented message delivery", async () => {
    // Re-wrap the ws so every frame is delivered in 7-byte chunks.
    const surface = new MemorySurface();
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
    const adapted = adaptNodeWebSocket(ws as never);
    const originalOnMessage = adapted.onmessage;
    adapted.onmessage = null;
    ws.on("message", (data: ArrayBuffer | Uint8Array) => {
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      for (let off = 0; off < bytes.length; off += 7) {
        const slice = bytes.subarray(off, Math.min(off + 7, bytes.length));
        originalOnMessage?.({ data: slice });
      }
    });
    client = new RfbClient({
      ws: adapted,
      surface,
      onStatus: (status) => statuses.push(status),
      onError: (message) => errors.push(message),
    });
    await waitFor(() => statuses.includes("connected"), "client to connect");
    await waitFor(() => surface.commitCount >= 1, "first framebuffer update");
    expect(surface.pixelAt(10, 5)).toEqual([10, 5, 128, 255]);
    expect(errors).toEqual([]);
  });
});

describe("bgrxToRgba", () => {
  it("converts B,G,R,X wire bytes to R,G,B,A", () => {
    const out = bgrxToRgba(new Uint8Array([10, 20, 30, 0, 255, 0, 0, 0]));
    expect(Array.from(out)).toEqual([30, 20, 10, 255, 0, 0, 255, 255]);
  });
});

function waitFor(predicate: () => boolean, what: string, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeoutMs) {
        return reject(new Error(`timed out waiting for ${what}`));
      }
      setTimeout(tick, 5);
    };
    tick();
  });
}
