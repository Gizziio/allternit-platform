/**
 * Minimal read-only RFB 3.x client over a binary WebSocket — the wire the
 * Allternit computer VNC proxy speaks (`/ws/computers/:id/vnc?token=...`).
 *
 * Scope (deliberate):
 * - Handshake: version exchange, None-auth (the proxy injects the guest VNC
 *   password and presents security type [1] = None to viewers), SecurityResult,
 *   ClientInit, ServerInit. RFB 3.3 fallback included for completeness.
 * - Encodings: raw (0) and copyrect (1), plus the desktop-size pseudo-encoding
 *   (-223). Hextile/tight/zrle are NOT implemented — the client only advertises
 *   what it decodes, so a conforming server never sends them.
 * - Input: NONE. KeyEvent/PointerEvent/ClientCutText are never sent. Embed
 *   tokens are read-only server-side too (`vnc_readonly` filter), but this
 *   client does not rely on that — it simply has no code path for input.
 *
 * Proven wire behavior this implements (see spec rq-20260909-004 Phase 5):
 * greeting `RFB 003.008\n`, security types [1] (None), 4-byte SecurityResult,
 * 1-byte ClientInit → ServerInit, then standard RFB both directions; server→client
 * type 0 = FramebufferUpdate; client→server FramebufferUpdateRequest is type 3
 * (NOT 0 — 0 is SetPixelFormat), KeyEvent type 4, PointerEvent type 5.
 */

import type { WebSocketLike } from "./websocket.js";

export type RfbStatus = "connecting" | "connected" | "disconnected" | "failed";

export interface RfbClientOptions {
  ws: WebSocketLike;
  surface: {
    resize(width: number, height: number): void;
    drawRect(
      x: number,
      y: number,
      width: number,
      height: number,
      rgba: Uint8Array | Uint8ClampedArray,
    ): void;
    copyRect(sx: number, sy: number, w: number, h: number, dx: number, dy: number): void;
    commit(): void;
  };
  onStatus?: (status: RfbStatus, detail?: string) => void;
  onError?: (message: string) => void;
}

const RFB_VERSION_3_8 = "RFB 003.008\n";

/** RFB message types, client → server. */
const MSG_SET_PIXEL_FORMAT = 0;
const MSG_SET_ENCODINGS = 2;
const MSG_FRAMEBUFFER_UPDATE_REQUEST = 3;

/** RFB message types, server → client. */
const SMSG_FRAMEBUFFER_UPDATE = 0;
const SMSG_SET_COLOR_MAP_ENTRIES = 1;
const SMSG_BELL = 2;
const SMSG_SERVER_CUT_TEXT = 3;

/** Encodings we advertise. */
const ENC_RAW = 0;
const ENC_COPYRECT = 1;
const ENC_DESKTOP_SIZE = -223; // 0xFFFFFF21

const SECURITY_NONE = 1;

type HandshakePhase =
  | "version"
  | "security-types"
  | "security-type-33" // RFB 3.3: server dictates one u32 type, no result follows for None
  | "security-result"
  | "server-init"
  | "server-init-done";

export class RfbClient {
  private readonly ws: WebSocketLike;
  private readonly surface: RfbClientOptions["surface"];
  private readonly onStatus?: (status: RfbStatus, detail?: string) => void;
  private readonly onError?: (message: string) => void;

  private buf = new Uint8Array(0);
  private phase: HandshakePhase = "version";
  private closed = false;
  /** Server minor protocol version from the greeting (8 for RFB 3.8). */
  private serverMinorVersion = 8;

  framebufferWidth = 0;
  framebufferHeight = 0;
  serverName = "";

  constructor(options: RfbClientOptions) {
    this.ws = options.ws;
    this.surface = options.surface;
    this.onStatus = options.onStatus;
    this.onError = options.onError;

    this.ws.binaryType = "arraybuffer";
    this.ws.onopen = () => {
      this.setStatus("connecting", "version exchange");
      // Send our highest supported version immediately, like noVNC does. The
      // server greeting arrives right after; we parse it but do NOT reply —
      // the version string was already sent, and echoing would inject a
      // second version string into the proxied stream.
      this.sendBytes(encodeAscii(RFB_VERSION_3_8));
    };
    this.ws.onmessage = (event) => {
      const data = normalizeMessageData(event.data);
      if (data) this.feed(data);
    };
    this.ws.onclose = (event) => {
      if (!this.closed) {
        this.closed = true;
        this.setStatus("disconnected", event.wasClean ? "closed" : "connection lost");
      }
    };
    this.ws.onerror = () => {
      this.fail("WebSocket error");
    };
  }

  /** Close the connection. Idempotent. */
  disconnect(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.ws.close();
    } catch {
      // ignore
    }
    this.setStatus("disconnected", "closed");
  }

  // ── Sending ────────────────────────────────────────────────────────────────

  /** The client NEVER sends KeyEvent (4), PointerEvent (5), or ClientCutText (6). */

  private sendSetPixelFormat(): void {
    const msg = new Uint8Array(20);
    const v = dv(msg);
    msg[0] = MSG_SET_PIXEL_FORMAT; // 0; pad bytes 1..3 stay 0
    // 16-byte PIXEL_FORMAT: force 32bpp true-color little-endian RGBX so raw
    // decoding is deterministic regardless of the server's default format.
    msg[4] = 32; // bits-per-pixel
    msg[5] = 24; // depth
    msg[6] = 0; // big-endian flag
    msg[7] = 1; // true-color flag
    v.setUint16(8, 255, true); // red max
    v.setUint16(10, 255, true); // green max
    v.setUint16(12, 255, true); // blue max
    msg[14] = 16; // red shift
    msg[15] = 8; // green shift
    msg[16] = 0; // blue shift
    // bytes 17..19 pad
    this.sendBytes(msg);
  }

  private sendSetEncodings(): void {
    const encodings = [ENC_RAW, ENC_COPYRECT, ENC_DESKTOP_SIZE];
    const msg = new Uint8Array(4 + 4 * encodings.length);
    const v = dv(msg);
    msg[0] = MSG_SET_ENCODINGS; // 2; pad byte 1 stays 0
    v.setUint16(2, encodings.length, false);
    encodings.forEach((enc, i) => v.setInt32(4 + i * 4, enc, false));
    this.sendBytes(msg);
  }

  private sendFramebufferUpdateRequest(incremental: boolean): void {
    const msg = new Uint8Array(10);
    const v = dv(msg);
    msg[0] = MSG_FRAMEBUFFER_UPDATE_REQUEST; // 3
    msg[1] = incremental ? 1 : 0;
    v.setUint16(2, 0, false);
    v.setUint16(4, 0, false);
    v.setUint16(6, this.framebufferWidth, false);
    v.setUint16(8, this.framebufferHeight, false);
    this.sendBytes(msg);
  }

  private sendBytes(data: Uint8Array): void {
    if (this.closed) return;
    try {
      this.ws.send(data);
    } catch (err) {
      this.fail(`send failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Receiving ──────────────────────────────────────────────────────────────

  private feed(chunk: Uint8Array): void {
    if (this.closed) return;
    const next = new Uint8Array(this.buf.length + chunk.length);
    next.set(this.buf, 0);
    next.set(chunk, this.buf.length);
    this.buf = next;

    try {
      if (this.phase !== "server-init-done") {
        this.drainHandshake();
      } else {
        this.drainMessages();
      }
    } catch (err) {      this.fail(err instanceof Error ? err.message : String(err));
    }
  }

  private drainHandshake(): void {
    for (;;) {
      switch (this.phase) {
        case "version": {
          const greeting = this.take(12);
          if (!greeting) return;
          const greetingText = ascii(greeting);
          if (greetingText.slice(0, 4) !== "RFB ") {
            throw new Error("server did not send an RFB greeting");
          }
          // The version reply was already sent on open; here we only parse
          // the server's version to decide 3.8 vs 3.3 framing.
          const minor = Number.parseInt(greetingText.slice(8, 11), 10);
          this.serverMinorVersion = Number.isFinite(minor) ? minor : 8;
          this.phase = this.serverMinorVersion >= 8 ? "security-types" : "security-type-33";
          break;
        }
        case "security-types": {
          const head = this.peek(1);
          if (!head) return;
          const count = head[0]!;
          if (count === 0) {
            // Connection failed; a reason-length u32 + reason follows.
            const lenBytes = this.take(5);
            if (!lenBytes) return;
            const len = dv(lenBytes).getUint32(1, false);
            const reason = this.take(len);
            if (!reason) {
              this.untake(lenBytes);
              return;
            }
            throw new Error(`security handshake refused: ${ascii(reason)}`);
          }
          const types = this.take(1 + count);
          if (!types) return;
          if (!types.subarray(1).includes(SECURITY_NONE)) {
            throw new Error("server did not offer None security");
          }
          this.sendBytes(new Uint8Array([SECURITY_NONE]));
          this.phase = "security-result";
          break;
        }
        case "security-result": {
          // RFB 3.8: after the client's choice the server sends a u32 result.
          const result = this.take(4);
          if (!result) return;
          const code = dv(result).getUint32(0, false);
          if (code !== 0) {
            throw new Error(`security handshake failed (result ${code})`);
          }
          this.sendBytes(new Uint8Array([1])); // ClientInit: shared = true
          this.phase = "server-init";
          break;
        }
        case "security-type-33": {
          // RFB 3.3: the server dictates one u32 security type; None means no
          // SecurityResult message follows.
          const ty = this.take(4);
          if (!ty) return;
          const code = dv(ty).getUint32(0, false);
          if (code !== SECURITY_NONE) {
            throw new Error(`server demanded unsupported security type ${code}`);
          }
          this.sendBytes(new Uint8Array([1]));
          this.phase = "server-init";
          break;
        }
        case "server-init": {
          const fixed = this.take(24);
          if (!fixed) return;
          const v = dv(fixed);
          this.framebufferWidth = v.getUint16(0, false);
          this.framebufferHeight = v.getUint16(2, false);
          const nameLength = v.getUint32(20, false);
          if (nameLength > 1 << 20) throw new Error("unreasonable ServerInit name length");
          const name = this.take(nameLength);
          if (!name) {
            this.untake(fixed);
            return;
          }
          this.serverName = ascii(name);
          this.surface.resize(this.framebufferWidth, this.framebufferHeight);
          this.sendSetPixelFormat();
          this.sendSetEncodings();
          this.sendFramebufferUpdateRequest(false);
          this.phase = "server-init-done";
          this.setStatus("connected", this.serverName);
          return;
        }
      }
    }
  }

  private drainMessages(): void {
    for (;;) {
      const head = this.peek(1);
      if (!head) return;
      switch (head[0]) {
        case SMSG_FRAMEBUFFER_UPDATE: {
          const header = this.take(4);
          if (!header) return;
          const rectCount = dv(header).getUint16(2, false);
          for (let i = 0; i < rectCount; i++) {
            if (!this.drainRect()) return;
          }
          this.surface.commit();
          this.sendFramebufferUpdateRequest(true);
          break;
        }
        case SMSG_SET_COLOR_MAP_ENTRIES: {
          // u8 pad, u16 first, u16 ncolors, then ncolors * 6 bytes.
          const header = this.take(8);
          if (!header) return;
          const n = dv(header).getUint16(6, false);
          if (!this.take(n * 6)) {
            this.untake(header);
            return;
          }
          break;
        }
        case SMSG_BELL: {
          if (!this.take(1)) return;
          break;
        }
        case SMSG_SERVER_CUT_TEXT: {
          const header = this.take(8);
          if (!header) return;
          const len = dv(header).getUint32(4, false);
          if (len > 1 << 20) throw new Error("unreasonable ServerCutText length");
          if (!this.take(len)) {
            this.untake(header);
            return;
          }
          break;
        }
        default:
          throw new Error(`unsupported server message type ${head[0]}`);
      }
    }
  }

  /** Decode one rectangle; returns false when more data is needed. */
  private drainRect(): boolean {
    const header = this.take(12);
    if (!header) return false;
    const v = dv(header);
    const x = v.getUint16(0, false);
    const y = v.getUint16(2, false);
    const w = v.getUint16(4, false);
    const h = v.getUint16(6, false);
    const encoding = v.getInt32(8, false);

    switch (encoding) {
      case ENC_RAW: {
        const pixels = this.take(w * h * 4);
        if (!pixels) {
          this.untake(header);
          return false;
        }
        this.surface.drawRect(x, y, w, h, bgrxToRgba(pixels));
        return true;
      }
      case ENC_COPYRECT: {
        const coords = this.take(4);
        if (!coords) {
          this.untake(header);
          return false;
        }
        const c = dv(coords);
        this.surface.copyRect(c.getInt16(0, false), c.getInt16(2, false), w, h, x, y);
        return true;
      }
      case ENC_DESKTOP_SIZE: {
        // Pseudo-encoding: rect w,h carries the new framebuffer size, no pixels.
        this.framebufferWidth = w;
        this.framebufferHeight = h;
        this.surface.resize(w, h);
        // Force a full (non-incremental) repaint at the new size.
        this.sendFramebufferUpdateRequest(false);
        return true;
      }
      default:
        throw new Error(
          `unsupported encoding ${encoding} — the client only advertises raw/copyrect/desktop-size`,
        );
    }
  }

  // ── Buffer helpers ─────────────────────────────────────────────────────────

  private peek(n: number): Uint8Array | null {
    return this.buf.length >= n ? this.buf.subarray(0, n) : null;
  }

  private take(n: number): Uint8Array | null {
    if (this.buf.length < n) return null;
    const out = this.buf.subarray(0, n);
    this.buf = this.buf.subarray(n);
    return out;
  }

  /** Put bytes back (used when a multi-part message needs more data). */
  private untake(bytes: Uint8Array): void {
    this.buf = concat(bytes, this.buf);
  }

  private setStatus(status: RfbStatus, detail?: string): void {
    this.onStatus?.(status, detail);
  }

  private fail(message: string): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.ws.close();
    } catch {
      // ignore
    }
    this.setStatus("failed", message);
    this.onError?.(message);
  }
}

// ── Free helpers ─────────────────────────────────────────────────────────────

/** Convert the forced 32bpp little-endian B,G,R,X wire format to R,G,B,A. */
export function bgrxToRgba(bgrx: Uint8Array): Uint8ClampedArray {
  const count = bgrx.length / 4;
  const rgba = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    rgba[i * 4] = bgrx[i * 4 + 2]!;
    rgba[i * 4 + 1] = bgrx[i * 4 + 1]!;
    rgba[i * 4 + 2] = bgrx[i * 4]!;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

/** DataView over a subarray — honors byteOffset (take() returns views). */
function dv(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function concat(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function encodeAscii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0x7f;
  return out;
}

function ascii(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

function normalizeMessageData(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return null; // ignore text frames (the proxy is binary-only)
}
