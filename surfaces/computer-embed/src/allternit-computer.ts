/**
 * `<allternit-computer>` — embeddable read-only live-computer widget.
 *
 * Usage (see README.md for the full two-line snippet):
 *
 *   <script type="module" src="https://your-host/embed/dist/embed-page.js"></script>
 *   <allternit-computer host="https://api.example.com" computer="cmp_…"
 *                       token="…" hosts="api.example.com" style="height:360px"></allternit-computer>
 *
 * Attributes:
 * - `src`       Full ws(s) URL of the VNC proxy (overrides host/computer derivation).
 * - `host`      API origin, e.g. https://api.example.com → wss://api.example.com.
 * - `computer`  Computer id (path segment of the VNC ws route).
 * - `token`     Embed token (mint server-side; see README). Sent only as the
 *               `?token=` query param of the VNC ws connection.
 * - `hosts`     Space-separated allowlist of hostnames the component is
 *               permitted to connect to. When set, a target whose hostname is
 *               not listed is refused. When omitted, any host is allowed —
 *               mirror of the server's default `frame-ancestors *`; set it.
 * - `label`     Optional text shown in the status bar; defaults to "view-only".
 *
 * The component renders a canvas plus a small status line. It never sends
 * input: the RFB client has no KeyEvent/PointerEvent/ClientCutText code path,
 * and embed tokens are read-only on the server as well.
 */

import { RfbClient, type RfbStatus } from "./rfb-client.js";
import { resolveWsUrl } from "./resolve-url.js";
import { createCanvasSurface } from "./surface.js";
import { adaptBrowserWebSocket } from "./websocket.js";

const STATUS_TEXT: Record<RfbStatus, string> = {
  connecting: "connecting…",
  connected: "connected",
  disconnected: "disconnected",
  failed: "connection failed",
};

export class AllternitComputer extends HTMLElement {
  static observedAttributes = ["src", "host", "computer", "token", "hosts", "label"];

  private client: RfbClient | null = null;
  private readonly root: ShadowRoot;
  private readonly canvas: HTMLCanvasElement;
  private readonly statusEl: HTMLSpanElement;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.root.innerHTML = `
      <style>
        :host { display: block; background: #0b0b0c; color: #e5e5e5;
                font: 12px/1.4 system-ui, -apple-system, sans-serif; }
        .wrap { display: flex; flex-direction: column; width: 100%; height: 100%;
                min-height: 120px; border-radius: 10px; overflow: hidden;
                border: 1px solid #1f1f23; }
        .screen { position: relative; flex: 1; min-height: 0; background: #000; }
        canvas { position: absolute; inset: 0; width: 100%; height: 100%;
                 object-fit: contain; }
        .bar { display: flex; align-items: center; gap: 8px; padding: 6px 10px;
               background: #101013; border-top: 1px solid #1f1f23;
               color: #a1a1aa; user-select: none; }
        .brand { font-weight: 600; letter-spacing: .02em; color: #e5e5e5; }
        .dot { width: 7px; height: 7px; border-radius: 50%; background: #71717a; }
        :host([data-status="connected"]) .dot { background: #22c55e; }
        :host([data-status="connecting"]) .dot { background: #f59e0b; }
        :host([data-status="failed"]) .dot { background: #ef4444; }
        .status { margin-left: auto; }
      </style>
      <div class="wrap">
        <div class="screen"><canvas></canvas></div>
        <div class="bar">
          <span class="dot"></span>
          <span class="brand">Allternit</span>
          <span>·</span>
          <span class="mode"></span>
          <span class="status"></span>
        </div>
      </div>`;
    this.canvas = this.root.querySelector("canvas")!;
    this.statusEl = this.root.querySelector(".status")!;
    (this.root.querySelector(".mode") as HTMLElement).textContent = this.labelText();
  }

  connectedCallback(): void {
    this.connect();
  }

  disconnectedCallback(): void {
    this.teardown();
  }

  attributeChangedCallback(): void {
    (this.root.querySelector(".mode") as HTMLElement).textContent = this.labelText();
    if (this.isConnected) this.connect();
  }

  private labelText(): string {
    return this.getAttribute("label")?.trim() || "view-only";
  }

  private teardown(): void {
    this.client?.disconnect();
    this.client = null;
  }

  private connect(): void {
    this.teardown();
    try {
      const url = resolveWsUrl(this.getAttribute.bind(this));
      if (!this.hostAllowed(new URL(url))) {
        this.setStatus("failed", "host not allowed");
        return;
      }
      const ws = adaptBrowserWebSocket(new WebSocket(url));
      this.client = new RfbClient({
        ws,
        surface: createCanvasSurface(this.canvas),
        onStatus: (status, detail) => this.setStatus(status, detail),
      });
    } catch (err) {
      this.setStatus("failed", err instanceof Error ? err.message : String(err));
    }
  }

  private setStatus(status: RfbStatus, detail?: string): void {
    this.setAttribute("data-status", status);
    const base = STATUS_TEXT[status];
    this.statusEl.textContent =
      status === "connected" && detail ? `${base} — ${detail}` : base;
  }

  /** The `hosts` attribute is a space-separated hostname allowlist. */
  private hostAllowed(url: URL): boolean {
    const allowlist = (this.getAttribute("hosts") ?? "")
      .split(/\s+/)
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    if (allowlist.length === 0) return true; // documented default; set the allowlist
    return allowlist.includes(url.hostname.toLowerCase());
  }
}

export { resolveWsUrl } from "./resolve-url.js";
export type { AttrGetter } from "./resolve-url.js";

if (typeof customElements !== "undefined" && !customElements.get("allternit-computer")) {
  customElements.define("allternit-computer", AllternitComputer);
}
