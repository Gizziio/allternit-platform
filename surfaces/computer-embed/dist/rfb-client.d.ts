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
        drawRect(x: number, y: number, width: number, height: number, rgba: Uint8Array | Uint8ClampedArray): void;
        copyRect(sx: number, sy: number, w: number, h: number, dx: number, dy: number): void;
        commit(): void;
    };
    onStatus?: (status: RfbStatus, detail?: string) => void;
    onError?: (message: string) => void;
}
export declare class RfbClient {
    private readonly ws;
    private readonly surface;
    private readonly onStatus?;
    private readonly onError?;
    private buf;
    private phase;
    private closed;
    /** Server minor protocol version from the greeting (8 for RFB 3.8). */
    private serverMinorVersion;
    framebufferWidth: number;
    framebufferHeight: number;
    serverName: string;
    constructor(options: RfbClientOptions);
    /** Close the connection. Idempotent. */
    disconnect(): void;
    /** The client NEVER sends KeyEvent (4), PointerEvent (5), or ClientCutText (6). */
    private sendSetPixelFormat;
    private sendSetEncodings;
    private sendFramebufferUpdateRequest;
    private sendBytes;
    private feed;
    private drainHandshake;
    private drainMessages;
    /** Decode one rectangle; returns false when more data is needed. */
    private drainRect;
    private peek;
    private take;
    /** Put bytes back (used when a multi-part message needs more data). */
    private untake;
    private setStatus;
    private fail;
}
/** Convert the forced 32bpp little-endian B,G,R,X wire format to R,G,B,A. */
export declare function bgrxToRgba(bgrx: Uint8Array): Uint8ClampedArray;
