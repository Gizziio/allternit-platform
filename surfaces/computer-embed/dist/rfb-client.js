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
export class RfbClient {
    constructor(options) {
        this.buf = new Uint8Array(0);
        this.phase = "version";
        this.closed = false;
        /** Server minor protocol version from the greeting (8 for RFB 3.8). */
        this.serverMinorVersion = 8;
        this.framebufferWidth = 0;
        this.framebufferHeight = 0;
        this.serverName = "";
        this.ws = options.ws;
        this.surface = options.surface;
        this.onStatus = options.onStatus;
        this.onError = options.onError;
        this.ws.binaryType = "arraybuffer";
        this.ws.onopen = () => {
            this.setStatus("connecting", "awaiting server greeting");
            // Nothing is sent here: RFB is server-speaks-first. The version reply
            // goes out only after the greeting is parsed (see drainHandshake) —
            // sending it early would strand the bytes in the API proxy's handshake
            // interceptor, which does not re-drain client bytes that arrive before
            // the server's greeting (verified live against the real ws proxy).
        };
        this.ws.onmessage = (event) => {
            const data = normalizeMessageData(event.data);
            if (data)
                this.feed(data);
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
    disconnect() {
        if (this.closed)
            return;
        this.closed = true;
        try {
            this.ws.close();
        }
        catch {
            // ignore
        }
        this.setStatus("disconnected", "closed");
    }
    // ── Sending ────────────────────────────────────────────────────────────────
    /** The client NEVER sends KeyEvent (4), PointerEvent (5), or ClientCutText (6). */
    sendSetPixelFormat() {
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
    sendSetEncodings() {
        const encodings = [ENC_RAW, ENC_COPYRECT, ENC_DESKTOP_SIZE];
        const msg = new Uint8Array(4 + 4 * encodings.length);
        const v = dv(msg);
        msg[0] = MSG_SET_ENCODINGS; // 2; pad byte 1 stays 0
        v.setUint16(2, encodings.length, false);
        encodings.forEach((enc, i) => v.setInt32(4 + i * 4, enc, false));
        this.sendBytes(msg);
    }
    sendFramebufferUpdateRequest(incremental) {
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
    sendBytes(data) {
        if (this.closed)
            return;
        try {
            this.ws.send(data);
        }
        catch (err) {
            this.fail(`send failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // ── Receiving ──────────────────────────────────────────────────────────────
    feed(chunk) {
        if (this.closed)
            return;
        const next = new Uint8Array(this.buf.length + chunk.length);
        next.set(this.buf, 0);
        next.set(chunk, this.buf.length);
        this.buf = next;
        try {
            if (this.phase !== "server-init-done") {
                this.drainHandshake();
            }
            else {
                this.drainMessages();
            }
        }
        catch (err) {
            this.fail(err instanceof Error ? err.message : String(err));
        }
    }
    drainHandshake() {
        for (;;) {
            switch (this.phase) {
                case "version": {
                    const greeting = this.take(12);
                    if (!greeting)
                        return;
                    const greetingText = ascii(greeting);
                    if (greetingText.slice(0, 4) !== "RFB ") {
                        throw new Error("server did not send an RFB greeting");
                    }
                    // Parse the server's version to decide 3.8 vs 3.3 framing, then
                    // reply with our version (RFB is server-speaks-first).
                    const minor = Number.parseInt(greetingText.slice(8, 11), 10);
                    this.serverMinorVersion = Number.isFinite(minor) ? minor : 8;
                    this.phase = this.serverMinorVersion >= 8 ? "security-types" : "security-type-33";
                    // The server spoke first; now reply with our highest version.
                    this.sendBytes(encodeAscii(RFB_VERSION_3_8));
                    break;
                }
                case "security-types": {
                    const head = this.peek(1);
                    if (!head)
                        return;
                    const count = head[0];
                    if (count === 0) {
                        // Connection failed; a reason-length u32 + reason follows.
                        const lenBytes = this.take(5);
                        if (!lenBytes)
                            return;
                        const len = dv(lenBytes).getUint32(1, false);
                        const reason = this.take(len);
                        if (!reason) {
                            this.untake(lenBytes);
                            return;
                        }
                        throw new Error(`security handshake refused: ${ascii(reason)}`);
                    }
                    const types = this.take(1 + count);
                    if (!types)
                        return;
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
                    if (!result)
                        return;
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
                    if (!ty)
                        return;
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
                    if (!fixed)
                        return;
                    const v = dv(fixed);
                    this.framebufferWidth = v.getUint16(0, false);
                    this.framebufferHeight = v.getUint16(2, false);
                    const nameLength = v.getUint32(20, false);
                    if (nameLength > 1 << 20)
                        throw new Error("unreasonable ServerInit name length");
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
    drainMessages() {
        for (;;) {
            const head = this.peek(1);
            if (!head)
                return;
            switch (head[0]) {
                case SMSG_FRAMEBUFFER_UPDATE: {
                    // A FramebufferUpdate must be consumed atomically: every advertised
                    // encoding is fixed-size (raw = w*h*4, copyrect = 4, desktop-size =
                    // 0), so the whole message length is computable from the rect
                    // headers. Wait for ALL of it before taking anything — consuming
                    // the 4-byte header and then bailing on an incomplete rect would
                    // desync the stream (verified live: mid-rect ws fragmentation of a
                    // full-screen raw update killed the parse on the next byte).
                    if (!this.peek(4))
                        return;
                    const rectCount = dv(this.buf.subarray(0, 4)).getUint16(2, false);
                    let off = 4;
                    for (let i = 0; i < rectCount; i++) {
                        const rectHeader = this.peek(off + 12);
                        if (!rectHeader)
                            return;
                        const rv = dv(rectHeader.subarray(off, off + 12));
                        const w = rv.getUint16(4, false);
                        const h = rv.getUint16(6, false);
                        const encoding = rv.getInt32(8, false);
                        const payload = encoding === ENC_RAW
                            ? w * h * 4
                            : encoding === ENC_COPYRECT
                                ? 4
                                : encoding === ENC_DESKTOP_SIZE
                                    ? 0
                                    : -1;
                        if (payload < 0) {
                            throw new Error(`unsupported encoding ${encoding} — the client only advertises raw/copyrect/desktop-size`);
                        }
                        off += 12 + payload;
                    }
                    if (this.buf.length < off)
                        return;
                    this.take(4);
                    for (let i = 0; i < rectCount; i++) {
                        this.drainRect();
                    }
                    this.surface.commit();
                    this.sendFramebufferUpdateRequest(true);
                    break;
                }
                case SMSG_SET_COLOR_MAP_ENTRIES: {
                    // u8 pad, u16 first, u16 ncolors, then ncolors * 6 bytes.
                    const header = this.take(8);
                    if (!header)
                        return;
                    const n = dv(header).getUint16(6, false);
                    if (!this.take(n * 6)) {
                        this.untake(header);
                        return;
                    }
                    break;
                }
                case SMSG_BELL: {
                    if (!this.take(1))
                        return;
                    break;
                }
                case SMSG_SERVER_CUT_TEXT: {
                    const header = this.take(8);
                    if (!header)
                        return;
                    const len = dv(header).getUint32(4, false);
                    if (len > 1 << 20)
                        throw new Error("unreasonable ServerCutText length");
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
    drainRect() {
        const header = this.take(12);
        if (!header)
            return false;
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
                throw new Error(`unsupported encoding ${encoding} — the client only advertises raw/copyrect/desktop-size`);
        }
    }
    // ── Buffer helpers ─────────────────────────────────────────────────────────
    peek(n) {
        return this.buf.length >= n ? this.buf.subarray(0, n) : null;
    }
    take(n) {
        if (this.buf.length < n)
            return null;
        const out = this.buf.subarray(0, n);
        this.buf = this.buf.subarray(n);
        return out;
    }
    /** Put bytes back (used when a multi-part message needs more data). */
    untake(bytes) {
        this.buf = concat(bytes, this.buf);
    }
    setStatus(status, detail) {
        this.onStatus?.(status, detail);
    }
    fail(message) {
        if (this.closed)
            return;
        this.closed = true;
        try {
            this.ws.close();
        }
        catch {
            // ignore
        }
        this.setStatus("failed", message);
        this.onError?.(message);
    }
}
// ── Free helpers ─────────────────────────────────────────────────────────────
/** Convert the forced 32bpp little-endian B,G,R,X wire format to R,G,B,A. */
export function bgrxToRgba(bgrx) {
    const count = bgrx.length / 4;
    const rgba = new Uint8ClampedArray(count * 4);
    for (let i = 0; i < count; i++) {
        rgba[i * 4] = bgrx[i * 4 + 2];
        rgba[i * 4 + 1] = bgrx[i * 4 + 1];
        rgba[i * 4 + 2] = bgrx[i * 4];
        rgba[i * 4 + 3] = 255;
    }
    return rgba;
}
/** DataView over a subarray — honors byteOffset (take() returns views). */
function dv(bytes) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
function concat(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
}
function encodeAscii(text) {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++)
        out[i] = text.charCodeAt(i) & 0x7f;
    return out;
}
function ascii(bytes) {
    let out = "";
    for (const b of bytes)
        out += String.fromCharCode(b);
    return out;
}
function normalizeMessageData(data) {
    if (data instanceof Uint8Array)
        return data;
    if (data instanceof ArrayBuffer)
        return new Uint8Array(data);
    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    return null; // ignore text frames (the proxy is binary-only)
}
//# sourceMappingURL=rfb-client.js.map