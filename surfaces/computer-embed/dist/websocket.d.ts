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
    onclose: ((event: {
        code: number;
        reason: string;
        wasClean: boolean;
    }) => void) | null;
    onerror: ((event: unknown) => void) | null;
    onmessage: ((event: {
        data: ArrayBuffer | Uint8Array | ArrayBufferView | string | unknown;
    }) => void) | null;
}
export declare const WS_OPEN = 1;
/** Adapt a browser `WebSocket`; it already matches {@link WebSocketLike}. */
export declare function adaptBrowserWebSocket(ws: WebSocket): WebSocketLike;
/**
 * Adapt a `ws` package client. Node delivers `Buffer`s; convert each message
 * to a plain `Uint8Array` view so the client sees one binary type.
 */
export declare function adaptNodeWebSocket(ws: {
    binaryType: string;
    readyState: number;
    send(data: ArrayBuffer | Uint8Array): void;
    close(): void;
    on(type: "open" | "close" | "error" | "message", listener: (...args: never[]) => void): void;
}): WebSocketLike;
