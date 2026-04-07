import { EventEmitter } from '../lib/EventEmitter';
import { AllternitOpenAIError } from '../error';
import { AzureOpenAI } from '../index';
export class AllternitOpenAIRealtimeError extends AllternitOpenAIError {
    /**
     * The error data that the API sent back in an `error` event.
     */
    error;
    /**
     * The unique ID of the server event.
     */
    event_id;
    constructor(message, event) {
        super(message);
        this.error = event?.error;
        this.event_id = event?.event_id;
    }
}
export class AllternitOpenAIRealtimeEmitter extends EventEmitter {
    _onError(event, message, cause) {
        message =
            event?.error ?
                `${event.error.message} code=${event.error.code} param=${event.error.param} type=${event.error.type} event_id=${event.error.event_id}`
                : message ?? 'unknown error';
        if (!this._hasListener('error')) {
            const error = new AllternitOpenAIRealtimeError(message +
                `\n\nTo resolve these unhandled rejection errors you should bind an \`error\` callback, e.g. \`rt.on('error', (error) => ...)\` `, event);
            // @ts-ignore
            error.cause = cause;
            Promise.reject(error);
            return;
        }
        const error = new AllternitOpenAIRealtimeError(message, event);
        // @ts-ignore
        error.cause = cause;
        this._emit('error', error);
    }
}
export function isAzure(client) {
    return client instanceof AzureOpenAI;
}
export function buildRealtimeURL(client, model) {
    const path = '/realtime';
    const baseURL = client.baseURL;
    const url = new URL(baseURL + (baseURL.endsWith('/') ? path.slice(1) : path));
    url.protocol = 'wss';
    if (isAzure(client)) {
        url.searchParams.set('api-version', client.apiVersion);
        url.searchParams.set('deployment', model);
    }
    else {
        url.searchParams.set('model', model);
    }
    return url;
}
//# sourceMappingURL=internal-base.js.map