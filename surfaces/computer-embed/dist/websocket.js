export const WS_OPEN = 1;
/** Adapt a browser `WebSocket`; it already matches {@link WebSocketLike}. */
export function adaptBrowserWebSocket(ws) {
    return ws;
}
/**
 * Adapt a `ws` package client. Node delivers `Buffer`s; convert each message
 * to a plain `Uint8Array` view so the client sees one binary type.
 */
export function adaptNodeWebSocket(ws) {
    const like = {
        get readyState() {
            return ws.readyState;
        },
        set binaryType(value) {
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
    ws.on("close", (code, reason) => like.onclose?.({ code, reason: reason ? reason.toString() : "", wasClean: code === 1000 }));
    ws.on("error", (err) => like.onerror?.(err));
    ws.on("message", (data) => {
        // Respect the consumer's binaryType: 'arraybuffer' yields ArrayBuffer,
        // 'nodebuffer' yields Buffer (a Uint8Array view onto a larger pool).
        if (data instanceof ArrayBuffer) {
            like.onmessage?.({ data });
            return;
        }
        const bytes = Array.isArray(data) ? data[0] : data;
        const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        like.onmessage?.({ data: buf });
    });
    return like;
}
//# sourceMappingURL=websocket.js.map