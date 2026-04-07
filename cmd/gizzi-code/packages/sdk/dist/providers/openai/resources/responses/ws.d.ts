import * as WS from 'ws';
import { ResponsesEmitter } from './internal-base';
import * as ResponsesAPI from './responses';
import { AllternitOpenAI } from '../../client';
export declare class ResponsesWS extends ResponsesEmitter {
    url: URL;
    socket: WS.WebSocket;
    private client;
    constructor(client: AllternitOpenAI, options?: WS.ClientOptions | null | undefined);
    send(event: ResponsesAPI.ResponsesClientEvent): void;
    close(props?: {
        code: number;
        reason: string;
    }): void;
    private authHeaders;
}
//# sourceMappingURL=ws.d.ts.map