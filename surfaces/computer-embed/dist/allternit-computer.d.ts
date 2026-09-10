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
export declare class AllternitComputer extends HTMLElement {
    static observedAttributes: string[];
    private client;
    private readonly root;
    private readonly canvas;
    private readonly statusEl;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(): void;
    private labelText;
    private teardown;
    private connect;
    private setStatus;
    /** The `hosts` attribute is a space-separated hostname allowlist. */
    private hostAllowed;
}
export { resolveWsUrl } from "./resolve-url.js";
export type { AttrGetter } from "./resolve-url.js";
