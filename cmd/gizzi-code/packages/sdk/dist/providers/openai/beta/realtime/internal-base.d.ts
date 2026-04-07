import { RealtimeClientEvent, RealtimeServerEvent, ErrorEvent } from '../../resources/beta/realtime/realtime';
import { EventEmitter } from '../../lib/EventEmitter';
import { AllternitOpenAIError } from '../../error';
import { AzureOpenAI } from '../../index';
export declare class AllternitOpenAIRealtimeError extends AllternitOpenAIError {
    /**
     * The error data that the API sent back in an `error` event.
     */
    error?: ErrorEvent.Error | undefined;
    /**
     * The unique ID of the server event.
     */
    event_id?: string | undefined;
    constructor(message: string, event: ErrorEvent | null);
}
type Simplify<T> = {
    [KeyType in keyof T]: T[KeyType];
} & {};
type RealtimeEvents = Simplify<{
    event: (event: RealtimeServerEvent) => void;
    error: (error: AllternitOpenAIRealtimeError) => void;
} & {
    [EventType in Exclude<RealtimeServerEvent['type'], 'error'>]: (event: Extract<RealtimeServerEvent, {
        type: EventType;
    }>) => unknown;
}>;
export declare abstract class AllternitOpenAIRealtimeEmitter extends EventEmitter<RealtimeEvents> {
    /**
     * Send an event to the API.
     */
    abstract send(event: RealtimeClientEvent): void;
    /**
     * Close the websocket connection.
     */
    abstract close(props?: {
        code: number;
        reason: string;
    }): void;
    protected _onError(event: null, message: string, cause: any): void;
    protected _onError(event: ErrorEvent, message?: string | undefined): void;
}
export declare function isAzure(client: Pick<AllternitOpenAI, 'apiKey' | 'baseURL'>): client is AzureOpenAI;
export declare function buildRealtimeURL(client: Pick<AllternitOpenAI, 'apiKey' | 'baseURL'>, model: string): URL;
export {};
//# sourceMappingURL=internal-base.d.ts.map