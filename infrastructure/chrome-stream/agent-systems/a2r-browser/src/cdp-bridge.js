export class CDPBridge {
    page;
    session = null;
    log = [];
    constructor(page) {
        this.page = page;
    }
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
    getNetworkLog() {
        return this.log;
    }
    async getCookies() {
        return await this.page.context().cookies();
    }
    async setCookies(cookies) {
        await this.page.context().addCookies(cookies);
    }
    async evaluateInPage(script) {
        return await this.page.evaluate(script);
    }
}
//# sourceMappingURL=cdp-bridge.js.map