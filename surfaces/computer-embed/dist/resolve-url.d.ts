/**
 * Resolve the VNC ws URL for `<allternit-computer>` / the embed page, from
 * either a full `src` ws(s) URL or `host` + `computer` + `token`. Pure
 * function, kept separate from the web component so it is testable headless
 * (the component module requires DOM globals at class-definition time).
 */
export type AttrGetter = (name: string) => string | null;
/**
 * Resolve the VNC ws URL from `src`, or derive it from `host` + `computer` +
 * `token` using the documented proxy path
 * (`{ws}://{host}/ws/computers/:id/vnc?token=…`).
 */
export declare function resolveWsUrl(get: AttrGetter): string;
