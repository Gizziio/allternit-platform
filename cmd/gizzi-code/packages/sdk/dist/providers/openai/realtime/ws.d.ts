import * as WS from 'ws';
import { AzureOpenAI, AllternitOpenAI } from '../index';
import type { RealtimeClientEvent } from '../resources/realtime/realtime';
import { AllternitOpenAIRealtimeEmitter } from './internal-base';
export declare class AllternitOpenAIRealtimeWS extends AllternitOpenAIRealtimeEmitter {
    url: URL;
    socket: WS.WebSocket;
    constructor(props: {
        model: string;
        options?: WS.ClientOptions | undefined;
        /** @internal */ __resolvedApiKey?: boolean;
    }, client?: Pick<AllternitOpenAI, 'apiKey' | 'baseURL'>);
    static create(client: Pick<AllternitOpenAI, 'apiKey' | 'baseURL' | '_callApiKey'>, props: {
        model: string;
        options?: WS.ClientOptions | undefined;
    }): Promise<AllternitOpenAIRealtimeWS>;
    static azure(client: Pick<AzureOpenAI, '_callApiKey' | 'apiVersion' | 'apiKey' | 'baseURL' | 'deploymentName'>, props?: {
        deploymentName?: string;
        options?: WS.ClientOptions | undefined;
    }): Promise<AllternitOpenAIRealtimeWS>;
    send(event: RealtimeClientEvent): void;
    close(props?: {
        code: number;
        reason: string;
    }): void;
}
//# sourceMappingURL=ws.d.ts.map