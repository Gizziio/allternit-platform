/**
 * Minimal WebSocket abstraction so the RFB client runs in the browser
 * (native WebSocket) and in Node tests (the `ws` package) with a thin
 * adapter. Only the surface the client needs.
 */
export interface WebSocketLike {
  readonly readyState: number;
  binaryType: string;
  send(data: ArrayBuffer | Uint8Array<ArrayBufferLike>): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: ((event: { code: number; reason: string; wasClean: boolean }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage:
    | ((event: { data: ArrayBuffer | Uint8Array | ArrayBufferView | string | unknown }) => void)
    | null;
}

export const WS_OPEN = 1;

/** Adapt a browser `WebSocket`; it already matches {@link WebSocketLike}. */
export function adaptBrowserWebSocket(ws: WebSocket): WebSocketLike {
  return ws as unknown as WebSocketLike;
}

/**
 * Adapt a `ws` package client. Node delivers `Buffer`s; convert each message
 * to a plain `Uint8Array` view so the client sees one binary type.
 */
export function adaptNodeWebSocket(ws: {
  binaryType: string;
  readyState: number;
  send(data: ArrayBuffer | Uint8Array): void;
  close(): void;
  on(type: "open" | "close" | "error" | "message", listener: (...args: never[]) => void): void;
}): WebSocketLike {
  const like: WebSocketLike = {
    get readyState() {
      return ws.readyState;
    },
    set binaryType(value: string) {
      ws.binaryType = value;
    },
    get binaryType() {
      return ws.binaryType;
    },
    send: (data) => ws.send(data),
    close: () => ws.close(),
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
  };
  ws.on("open", () => like.onopen?.());
  ws.on("close", (code: number, reason: { toString(): string } | undefined) =>
    like.onclose?.({ code, reason: reason ? reason.toString() : "", wasClean: code === 1000 }),
  );
  ws.on("error", (err: unknown) => like.onerror?.(err));
  ws.on("message", (data: ArrayBuffer | Uint8Array | Uint8Array[]) => {
    // Respect the consumer's binaryType: 'arraybuffer' yields ArrayBuffer,
    // 'nodebuffer' yields Buffer (a Uint8Array view onto a larger pool).
    if (data instanceof ArrayBuffer) {
      like.onmessage?.({ data });
      return;
    }
    const bytes = Array.isArray(data) ? data[0]! : data;
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    like.onmessage?.({ data: buf });
  });
  return like;
}
