/**
 * Resolve the VNC ws URL for `<allternit-computer>` / the embed page, from
 * either a full `src` ws(s) URL or `host` + `computer` + `token`. Pure
 * function, kept separate from the web component so it is testable headless
 * (the component module requires DOM globals at class-definition time).
 */
/**
 * Resolve the VNC ws URL from `src`, or derive it from `host` + `computer` +
 * `token` using the documented proxy path
 * (`{ws}://{host}/ws/computers/:id/vnc?token=…`).
 */
export function resolveWsUrl(get) {
    const src = get("src")?.trim();
    if (src) {
        if (!/^wss?:\/\//.test(src)) {
            throw new Error(`src must be a ws:// or wss:// URL, got "${src}"`);
        }
        return appendToken(src, get("token"));
    }
    const host = get("host")?.trim();
    const computer = get("computer")?.trim();
    const token = get("token")?.trim();
    if (!host || !computer || !token) {
        throw new Error("allternit-computer needs either src, or host + computer + token");
    }
    const origin = new URL(host); // throws on garbage
    const scheme = origin.protocol === "https:" ? "wss:" : origin.protocol === "http:" ? "ws:" : null;
    if (!scheme) {
        throw new Error(`host must be an http(s) origin, got "${host}"`);
    }
    const base = `${scheme}//${origin.host}/ws/computers/${encodeURIComponent(computer)}/vnc`;
    return appendToken(base, token);
}
function appendToken(url, token) {
    const clean = token?.trim();
    if (!clean)
        return url;
    const sep = url.includes("?") ? "&" : "?";
    // A token is a credential: it travels in the URL by design of the proxy;
    // never log it, never place it in fragment-visible markup.
    return `${url}${sep}token=${encodeURIComponent(clean)}`;
}
//# sourceMappingURL=resolve-url.js.map