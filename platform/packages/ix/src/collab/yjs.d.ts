declare module 'yjs' {
  export class Doc {
    [key: string]: any;
    getText<T = any>(name?: string): any;
    getMap<T = any>(name?: string): any;
    getArray<T = any>(name?: string): any;
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    destroy(): void;
  }
  export class Text { [key: string]: any; }
  export class Map<T = any> { [key: string]: any; }
  export class Array<T = any> { [key: string]: any; }
  export function encodeStateVector(doc: Doc): Uint8Array;
  export function encodeStateAsUpdate(doc: Doc, encodedTargetStateVector?: Uint8Array): Uint8Array;
  export function applyUpdate(doc: Doc, update: Uint8Array, transactionOrigin?: any): void;
}

declare module 'y-webrtc' {
  export class WebrtcProvider {
    constructor(roomName: string, doc: any, options?: any);
    awareness: any;
    broadcastMessage(buf: Uint8Array): void;
    destroy(): void;
    [key: string]: any;
  }
}

declare module 'y-protocols/awareness' {
  export class Awareness {
    constructor(doc: any);
    getStates(): globalThis.Map<number, any>;
    getLocalState(): any;
    setLocalStateField(field: string, value: any): void;
    setLocalState(state: any): void;
    on(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    destroy(): void;
    [key: string]: any;
  }
  export const messageAwareness: number;
  export function encodeAwarenessUpdate(awareness: Awareness, clients: number[]): Uint8Array;
  export function applyAwarenessUpdate(awareness: Awareness, update: Uint8Array, origin: any): void;
  export function removeAwarenessStates(awareness: Awareness, clients: number[], origin: any): void;
}

declare module 'y-protocols/sync' {
  export const messageYjsSyncStep1: number;
  export const messageYjsSyncStep2: number;
  export const messageYjsUpdate: number;
  export function writeSyncStep1(encoder: any, doc: any): void;
  export function writeSyncStep2(encoder: any, doc: any, encodedStateVector?: Uint8Array): void;
  export function readSyncMessage(decoder: any, encoder: any, doc: any, transactionOrigin: any, ...args: any[]): number;
  export function readSyncStep1(decoder: any, encoder: any, doc: any): void;
  export function readSyncStep2(decoder: any, doc: any, transactionOrigin: any): void;
  export function readUpdate(decoder: any, doc: any, transactionOrigin: any): void;
  export function createUpdateMessage(update: Uint8Array): Uint8Array;
}

declare module 'lib0' {
  export namespace encoding {
    interface Encoder { [key: string]: any; }
    function createEncoder(): Encoder;
    function toUint8Array(encoder: Encoder): Uint8Array;
    function writeAny(encoder: Encoder, data: any): void;
    function writeVarUint(encoder: Encoder, num: number): void;
    function writeVarUint8Array(encoder: Encoder, uint8Array: Uint8Array): void;
  }
  export namespace decoding {
    interface Decoder { [key: string]: any; }
    function createDecoder(buf: Uint8Array): Decoder;
    function readVarUint(decoder: Decoder): number;
    function readVarUint8Array(decoder: Decoder): Uint8Array;
    function hasContent(decoder: Decoder): boolean;
  }
}
