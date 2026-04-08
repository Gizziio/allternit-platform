/**
 * Electron webview element type declarations
 */

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.WebViewHTMLAttributes<HTMLWebViewElement>, HTMLWebViewElement>;
    }
  }

  interface HTMLWebViewElement extends HTMLElement {
    src: string;
    partition?: string;
    allowpopups?: boolean;
    webpreferences?: string;
    nodeintegration?: boolean;
    nodeIntegration?: boolean;
    plugins?: boolean;
    preload?: string;
    httpreferrer?: string;
    useragent?: string;
    disablewebsecurity?: boolean;
    allowRunningInsecureContent?: boolean;
    
    // Methods
    getURL(): string;
    getTitle(): string;
    isLoading(): boolean;
    isWaitingForResponse(): boolean;
    stop(): void;
    reload(): void;
    reloadIgnoringCache(): void;
    canGoBack(): boolean;
    canGoForward(): boolean;
    goBack(): void;
    goForward(): void;
    executeJavaScript(code: string, userGesture?: boolean): Promise<any>;
    insertCSS(css: string): Promise<string>;
    removeInsertedCSS(key: string): Promise<void>;
    openDevTools(): void;
    closeDevTools(): void;
    isDevToolsOpened(): boolean;
    isDevToolsFocused(): boolean;
    inspectElement(x: number, y: number): void;
    inspectServiceWorker(): void;
    setAudioMuted(muted: boolean): void;
    isAudioMuted(): boolean;
    getWebContentsId(): number;
    
    // Event handlers
    onload?: (event: Event) => void;
    onerror?: (event: Event) => void;
    onloadstart?: (event: Event) => void;
    onloadstop?: (event: Event) => void;
    'ondid-finish-load'?: (event: Event) => void;
    'ondid-fail-load'?: (event: Event) => void;
    'ondid-frame-finish-load'?: (event: Event) => void;
    'ondid-start-loading'?: (event: Event) => void;
    'ondid-stop-loading'?: (event: Event) => void;
    'ondid-attach'?: (event: Event) => void;
    'onconsole-message'?: (event: Event) => void;
    'onipc-message'?: (event: Event) => void;
    'onpage-title-updated'?: (event: Event) => void;
    'onpage-favicon-updated'?: (event: Event) => void;
    'ondid-navigate'?: (event: Event) => void;
    'ondid-navigate-in-page'?: (event: Event) => void;
    onclose?: (event: Event) => void;
    oncrashed?: (event: Event) => void;
    'onplugin-crashed'?: (event: Event) => void;
    ondestroyed?: (event: Event) => void;
    'onmedia-started-playing'?: (event: Event) => void;
    'onmedia-paused'?: (event: Event) => void;
    'ondid-change-theme-color'?: (event: Event) => void;
    'onupdate-target-url'?: (event: Event) => void;
    'ondevtools-opened'?: (event: Event) => void;
    'ondevtools-closed'?: (event: Event) => void;
    'ondevtools-focused'?: (event: Event) => void;
    'onnew-window'?: (event: Event) => void;
    'onwill-navigate'?: (event: Event) => void;
    'ondid-start-navigation'?: (event: Event) => void;
    'onbefore-input-event'?: (event: Event) => void;
    'onzoom-changed'?: (event: Event) => void;
  }
}

export {};
