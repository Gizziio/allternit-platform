/**
 * Mock RFB 3.8 server over `ws` for integration tests. Implements the exact
 * None-auth wire behavior of the Allternit VNC proxy (greeting, security
 * types [1], 4-byte SecurityResult, 1-byte ClientInit → ServerInit) and then
 * speaks standard RFB with raw + copyrect encodings.
 */
import { WebSocketServer, type WebSocket as WsSocket } from "ws";

export interface MockRfbServerOptions {
  width?: number;
  height?: number;
  name?: string;
  /** Hold the greeting until `sendGreeting()` is called (ordering tests). */
  holdGreeting?: boolean;
  /** Split every outbound server message into chunks of this many bytes, sent
   * as separate ws frames — exercises client reassembly over real framing. */
  frameSplit?: number;
  /** Observe every client→server message (type byte + full payload). */
  onClientMessage?: (type: number, bytes: Uint8Array) => void;
}

export interface MockRfbServer {
  port: number;
  receivedTypes: number[];
  /** Total client→server bytes observed (any phase). */
  bytesReceived: number;
  close(): Promise<void>;
  /** Send the greeting when the server was started with `holdGreeting`. */
  sendGreeting(): void;
}

/** Deterministic BGRX pattern the mock paints: r=x, g=y, b=128. */
export function patternBgrx(x: number, y: number): [number, number, number, number] {
  return [128, y & 0xff, x & 0xff, 0]; // B, G, R, X
}

export async function startMockRfbServer(options: MockRfbServerOptions = {}): Promise<MockRfbServer> {
  const width = options.width ?? 64;
  const height = options.height ?? 48;
  const name = options.name ?? "mock-rfb";
  const receivedTypes: number[] = [];
  let bytesReceived = 0;
  const frameSplit = options.frameSplit && options.frameSplit > 0 ? options.frameSplit : 0;

  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => wss.once("listening", resolve));

  const sendChunked = (socket: WsSocket, data: Buffer | Uint8Array) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (!frameSplit || buf.length <= frameSplit) {
      socket.send(buf);
      return;
    }
    for (let off = 0; off < buf.length; off += frameSplit) {
      socket.send(buf.subarray(off, Math.min(off + frameSplit, buf.length)));
    }
  };

  let heldSocket: WsSocket | null = null;
  const sendGreeting = () => {
    if (heldSocket) {
      heldSocket.send(Buffer.from("RFB 003.008\n", "ascii"));
      heldSocket = null;
    }
  };

  wss.on("connection", (socket: WsSocket) => {
    let phase: "version" | "choice" | "init" | "normal" = "version";
    let firstFullRequestSeen = false;

    const reply = (data: Buffer) => sendChunked(socket, data);

    socket.on("message", (raw: Buffer) => {
      bytesReceived += raw.byteLength;
      const data = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
      if (phase === "version") {
        // Client version string received; advertise security types (None only),
        // mirroring the proxy's rewritten [1] offer.
        phase = "choice";
        reply(Buffer.from([1, 1]));
        return;
      }
      if (phase === "choice") {
        if (data[0] !== 1) {
          socket.close(1002, "mock: client must choose None security");
          return;
        }
        phase = "init";
        reply(Buffer.from([0, 0, 0, 0])); // SecurityResult: OK
        return;
      }
      if (phase === "init") {
        phase = "normal";
        reply(serverInit(width, height, name));
        return;
      }
      // Normal phase: parse one typed client message.
      const type = data[0]!;
      receivedTypes.push(type);
      options.onClientMessage?.(type, data);
      if (type === 3) {
        // FramebufferUpdateRequest: u8 incremental, x, y, w, h.
        const incremental = data[1]! === 1;
        if (!incremental && !firstFullRequestSeen) {
          firstFullRequestSeen = true;
          reply(firstUpdate(width, height));
        } else {
          reply(incrementalUpdate());
        }
      }
    });

    if (options.holdGreeting) {
      heldSocket = socket;
    } else {
      socket.send(Buffer.from("RFB 003.008\n", "ascii"));
    }
  });

  const address = wss.address();
  if (typeof address === "string" || !address) throw new Error("mock server has no address");

  return {
    port: address.port,
    receivedTypes,
    get bytesReceived() {
      return bytesReceived;
    },
    sendGreeting,
    close: () =>
      new Promise((resolve) => {
        for (const client of wss.clients) client.terminate();
        wss.close(() => resolve());
      }),
  };
}

function serverInit(width: number, height: number, name: string): Buffer {
  const nameBytes = Buffer.from(name, "ascii");
  const buf = Buffer.alloc(24 + nameBytes.length);
  buf.writeUInt16BE(width, 0);
  buf.writeUInt16BE(height, 2);
  // 16-byte pixel format: 32bpp true-color little-endian (informational —
  // the client immediately forces its own format).
  buf[4] = 32;
  buf[5] = 24;
  buf[6] = 0;
  buf[7] = 1;
  buf.writeUInt16BE(255, 8);
  buf.writeUInt16BE(255, 10);
  buf.writeUInt16BE(255, 12);
  buf[14] = 16;
  buf[15] = 8;
  buf[16] = 0;
  buf.writeUInt32BE(nameBytes.length, 20);
  nameBytes.copy(buf, 24);
  return buf;
}

/** First full update: one raw full-screen rect + one copyrect. */
function firstUpdate(width: number, height: number): Buffer {
  const rectCount = 2;
  const rawPixels = width * height * 4;
  const buf = Buffer.alloc(4 + (12 + rawPixels) + (12 + 4));
  buf.writeUInt8(0, 0); // FramebufferUpdate
  buf.writeUInt16BE(rectCount, 2);

  let off = 4;
  // Rect 1: raw, full screen.
  buf.writeUInt16BE(0, off); // x
  buf.writeUInt16BE(0, off + 2); // y
  buf.writeUInt16BE(width, off + 4);
  buf.writeUInt16BE(height, off + 6);
  buf.writeInt32BE(0, off + 8); // raw
  off += 12;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [b, g, r] = patternBgrx(x, y);
      buf[off] = b;
      buf[off + 1] = g;
      buf[off + 2] = r;
      buf[off + 3] = 0;
      off += 4;
    }
  }
  // Rect 2: copyrect — copy (0,0,16,12) to (20,20).
  buf.writeUInt16BE(20, off);
  buf.writeUInt16BE(20, off + 2);
  buf.writeUInt16BE(16, off + 4);
  buf.writeUInt16BE(12, off + 6);
  buf.writeInt32BE(1, off + 8); // copyrect
  off += 12;
  buf.writeInt16BE(0, off);
  buf.writeInt16BE(0, off + 2);
  return buf;
}

/** Subsequent incremental update: one 2x2 solid-blue raw rect at (5,5). */
function incrementalUpdate(): Buffer {
  const w = 2;
  const h = 2;
  const buf = Buffer.alloc(4 + 12 + w * h * 4);
  buf.writeUInt8(0, 0);
  buf.writeUInt16BE(1, 2);
  let off = 4;
  buf.writeUInt16BE(5, off);
  buf.writeUInt16BE(5, off + 2);
  buf.writeUInt16BE(w, off + 4);
  buf.writeUInt16BE(h, off + 6);
  buf.writeInt32BE(0, off + 8);
  off += 12;
  for (let i = 0; i < w * h; i++) {
    buf[off] = 255; // B
    buf[off + 1] = 0; // G
    buf[off + 2] = 0; // R
    buf[off + 3] = 0;
    off += 4;
  }
  return buf;
}
