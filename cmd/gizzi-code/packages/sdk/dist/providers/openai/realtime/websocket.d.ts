import { AzureOpenAI, AllternitOpenAI } from '../index';
import type { RealtimeClientEvent } from '../resources/realtime/realtime';
import { AllternitOpenAIRealtimeEmitter } from './internal-base';
type _WebSocket = typeof globalThis extends ({
    WebSocket: infer ws extends abstract new (...args: any) => any;
}) ? InstanceType<ws> : any;
export declare class AllternitOpenAIRealtimeWebSocket extends AllternitOpenAIRealtimeEmitter {
    url: URL;
    socket: _WebSocket;
    constructor(props: {
        model: string;
        dangerouslyAllowBrowser?: boolean;
        /**
         * Callback to mutate the URL, needed for Azure.
         * @internal
         */
        onURL?: (url: URL) => void;
        /** Indicates the token was resolved by the factory just before connecting. @internal */
        __resolvedApiKey?: boolean;
    }, client?: Pick<AllternitOpenAI, 'apiKey' | 'baseURL'>);
    static create(client: Pick<AllternitOpenAI, 'apiKey' | 'baseURL' | '_callApiKey'>, props: {
        model: string;
        dangerouslyAllowBrowser?: boolean;
    }): Promise<AllternitOpenAIRealtimeWebSocket>;
    static azure(client: Pick<AzureOpenAI, '_callApiKey' | 'apiVersion' | 'apiKey' | 'baseURL' | 'deploymentName'>, options?: {
        deploymentName?: string;
        dangerouslyAllowBrowser?: boolean;
    }): Promise<AllternitOpenAIRealtimeWebSocket>;
    send(event: RealtimeClientEvent): void;
    close(props?: {
        code: number;
        reason: string;
    }): void;
}
export {};
//# sourceMappingURL=websocket.d.ts.map