import type { FinalRequestOptions } from './request-options';
import { type BaseAllternitAI } from '../client';
import type { AbstractPage } from '../core/pagination';
export type APIResponseProps = {
    response: Response;
    options: FinalRequestOptions;
    controller: AbortController;
    requestLogID: string;
    retryOfRequestLogID: string | undefined;
    startTime: number;
};
export declare function defaultParseResponse<T>(client: BaseAllternitAI, props: APIResponseProps): Promise<WithRequestID<T>>;
export type WithRequestID<T> = T extends Array<any> | Response | AbstractPage<any> ? T : T extends Record<string, any> ? T & {
    _request_id?: string | null;
} : T;
export declare function addRequestID<T>(value: T, response: Response): WithRequestID<T>;
//# sourceMappingURL=parse.d.ts.map