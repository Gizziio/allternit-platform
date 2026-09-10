// ws.mjs — minimal RFC 6455 WebSocket server over node:net sockets.
// Text + binary frames, fragmentation reassembly, ping/pong, close handshake.
// No extensions (permessage-deflate refused), no subprotocols beyond "pr1".
// Zero npm dependencies — this is the module that later ports 1:1 to a Rust
// axum/tungstenite module (see README "Long-term home").

import { createHash, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export const OPCODES = { CONT: 0x0, TEXT: 0x1, BINARY: 0x2, CLOSE: 0x8, PING: 0x9, PONG: 0xa };

export function acceptKey(clientKey) {
  return createHash('sha1').update(clientKey + WS_GUID).digest('base64');
}

export function maskKey() {
  return randomBytes(4);
}

// Encode one frame. Server frames are unmasked; `mask` is for tests/clients.
export function encodeFrame(opcode, payload, { fin = true, mask = false } = {}) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = (fin ? 0x80 : 0) | opcode;
  if (!mask) return Buffer.concat([header, payload]);
  header[1] |= 0x80;
  const key = maskKey();
  const masked = Buffer.from(payload);
  for (let i = 0; i < masked.length; i++) masked[i] ^= key[i & 3];
  return Buffer.concat([header, key, masked]);
}

// Incremental frame parser. Returns events: {type:'message',opcode,data} for
// reassembled messages, {type:'ping'|'pong',data}, {type:'close',code,reason},
// or {type:'error',error} for protocol violations.
export class FrameParser {
  constructor({ maxPayload = 8 * 1024 * 1024 } = {}) {
    this.buf = Buffer.alloc(0);
    this.maxPayload = maxPayload;
    this.frag = null; // { opcode, chunks, size }
  }

  push(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    const events = [];
    for (;;) {
      const frame = this.#readFrame();
      if (!frame) break;
      if (frame.error) {
        events.push({ type: 'error', error: frame.error });
        break;
      }
      const { fin, opcode, payload } = frame;
      if (opcode >= 0x8) {
        if (!fin) {
          events.push({ type: 'error', error: 'fragmented control frame' });
          break;
        }
        if (opcode === OPCODES.CLOSE) {
          const code = payload.length >= 2 ? payload.readUInt16BE(0) : 1005;
          events.push({ type: 'close', code, reason: payload.subarray(2).toString('utf8'), payload });
        } else if (opcode === OPCODES.PING) {
          events.push({ type: 'ping', data: payload });
        } else {
          events.push({ type: 'pong', data: payload });
        }
        continue;
      }
      if (opcode === OPCODES.CONT) {
        if (!this.frag) {
          events.push({ type: 'error', error: 'unexpected continuation frame' });
          break;
        }
        this.frag.chunks.push(payload);
        this.frag.size += payload.length;
        if (this.frag.size > this.maxPayload) {
          events.push({ type: 'error', error: 'message too large' });
          break;
        }
        if (fin) {
          events.push({ type: 'message', opcode: this.frag.opcode, data: Buffer.concat(this.frag.chunks) });
          this.frag = null;
        }
        continue;
      }
      if (this.frag) {
        events.push({ type: 'error', error: 'new message before continuation finished' });
        break;
      }
      if (fin) {
        events.push({ type: 'message', opcode, data: payload });
      } else {
        this.frag = { opcode, chunks: [payload], size: payload.length };
      }
    }
    return events;
  }

  #readFrame() {
    const b = this.buf;
    if (b.length < 2) return null;
    const fin = (b[0] & 0x80) !== 0;
    const rsv = b[0] & 0x70;
    const opcode = b[0] & 0x0f;
    if (rsv !== 0) return { error: 'RSV bits set (extensions not negotiated)' };
    if (![0, 1, 2, 8, 9, 10].includes(opcode)) return { error: `bad opcode ${opcode}` };
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) {
      if (b.length < off + 2) return null;
      len = b.readUInt16BE(off);
      off += 2;
    } else if (len === 127) {
      if (b.length < off + 8) return null;
      const big = b.readBigUInt64BE(off);
      if (big > BigInt(this.maxPayload)) return { error: 'frame too large' };
      len = Number(big);
      off += 8;
    }
    if (len > this.maxPayload) return { error: 'frame too large' };
    let key = null;
    if (masked) {
      if (b.length < off + 4) return null;
      key = b.subarray(off, off + 4);
      off += 4;
    }
    if (b.length < off + len) return null;
    let payload = b.subarray(off, off + len);
    if (key) {
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= key[i & 3];
    }
    this.buf = b.subarray(off + len);
    return { fin, opcode, masked, payload };
  }
}

// A server-side WebSocket connection over an upgraded node:net socket.
// Emits: 'text' (string), 'binary' (Buffer), 'close' ({code, reason}), 'error'.
export class WSConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.parser = new FrameParser();
    this.closed = false;
    socket.on('data', (chunk) => this.#onData(chunk));
    socket.on('error', (err) => this.#fail(err));
    socket.on('close', () => this.#fail(null));
  }

  #onData(chunk) {
    let events;
    try {
      events = this.parser.push(chunk);
    } catch (err) {
      this.#fail(err);
      return;
    }
    for (const ev of events) {
      if (ev.type === 'message') {
        if (ev.opcode === OPCODES.TEXT) this.emit('text', ev.data.toString('utf8'));
        else this.emit('binary', ev.data);
      } else if (ev.type === 'ping') {
        this.#write(encodeFrame(OPCODES.PONG, ev.data));
      } else if (ev.type === 'pong') {
        this.emit('pong', ev.data);
      } else if (ev.type === 'close') {
        if (!this.closed) {
          this.closed = true;
          this.#write(encodeFrame(OPCODES.CLOSE, ev.payload ?? Buffer.alloc(0)));
        }
        this.socket.end();
        this.emit('close', { code: ev.code, reason: ev.reason });
      } else if (ev.type === 'error') {
        this.close(1002, ev.error);
        this.emit('error', new Error(ev.error));
      }
    }
  }

  #write(buf) {
    if (this.socket.destroyed) return false;
    return this.socket.write(buf);
  }

  // Bytes queued in the kernel/user buffer — callers use this to drop frames
  // under backpressure instead of growing memory.
  get buffered() {
    return this.socket.writableLength;
  }

  sendText(str) {
    return !this.closed && this.#write(encodeFrame(OPCODES.TEXT, Buffer.from(str, 'utf8')));
  }

  sendBinary(buf) {
    return !this.closed && this.#write(encodeFrame(OPCODES.BINARY, buf));
  }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    this.closed = true;
    const r = Buffer.from(reason, 'utf8');
    const payload = Buffer.alloc(2 + r.length);
    payload.writeUInt16BE(code, 0);
    r.copy(payload, 2);
    this.#write(encodeFrame(OPCODES.CLOSE, payload));
    this.socket.end();
  }

  #fail(err) {
    if (this.closed) return;
    this.closed = true;
    if (err) this.emit('error', err);
    this.emit('close', { code: 1006, reason: 'abnormal' });
    this.socket.destroy();
  }
}

// Validate an HTTP Upgrade request and complete the handshake.
// Returns a WSConnection, or writes an error response and returns null.
export function upgrade(req, socket, head) {
  const key = req.headers['sec-websocket-key'];
  const version = req.headers['sec-websocket-version'];
  const offered = String(req.headers['sec-websocket-protocol'] || '');
  if ((req.headers.upgrade || '').toLowerCase() !== 'websocket' || !key || version !== '13') {
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return null;
  }
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey(key)}`,
  ];
  if (offered.split(',').map((s) => s.trim()).includes('pr1')) {
    headers.push('Sec-WebSocket-Protocol: pr1');
  }
  socket.write(headers.join('\r\n') + '\r\n\r\n');
  const conn = new WSConnection(socket);
  if (head && head.length) conn.parser.push(head); // rare: bytes after upgrade
  return conn;
}
