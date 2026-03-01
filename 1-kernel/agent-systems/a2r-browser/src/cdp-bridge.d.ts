import { Page } from 'playwright';
export interface NetworkLogEntry {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: any;
    responseBody?: any;
}
export declare class CDPBridge {
    private page;
    private session;
    private log;
    constructor(page: Page);
    init(): Promise<void>;
    getNetworkLog(): NetworkLogEntry[];
    getCookies(): Promise<import("playwright").Cookie[]>;
    setCookies(cookies: any[]): Promise<void>;
    evaluateInPage(script: string): Promise<unknown>;
}
//# sourceMappingURL=cdp-bridge.d.ts.map