import { Page, CDPSession } from 'playwright';

export interface NetworkLogEntry {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: any;
  responseBody?: any;
}

export class CDPBridge {
  private session: CDPSession | null = null;
  private log: NetworkLogEntry[] = [];

  constructor(private page: Page) {}

  async init() {
    this.session = await this.page.context().newCDPSession(this.page);
    await this.session.send('Network.enable');
    
    this.session.on('Network.requestWillBeSent', (event) => {
      this.log.push({
        url: event.request.url,
        method: event.request.method,
        headers: event.request.headers,
        postData: event.request.postData
      });
    });
  }

  getNetworkLog(): NetworkLogEntry[] {
    return this.log;
  }

  async getCookies() {
    return await this.page.context().cookies();
  }

  async setCookies(cookies: any[]) {
    await this.page.context().addCookies(cookies);
  }

  async evaluateInPage(script: string) {
    return await this.page.evaluate(script);
  }
}
