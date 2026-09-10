/**
 * Bootstrap for the iframe-able embed page (embed.html). Reads configuration
 * from URL query params and mounts one <allternit-computer> element. Kept
 * tiny on purpose: the page is served statically next to dist/.
 *
 * Query params (mirroring the web component attributes):
 *   src, host, computer, token, hosts, label
 */
import { AllternitComputer } from "./allternit-computer.js";

export function mountEmbedPage(search: string = window.location.search): void {
  const params = new URLSearchParams(search);
  const el = document.createElement("allternit-computer") as AllternitComputer;
  for (const name of ["src", "host", "computer", "token", "hosts", "label"]) {
    const value = params.get(name);
    if (value) el.setAttribute(name, value);
  }
  document.body.appendChild(el);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountEmbedPage());
  } else {
    mountEmbedPage();
  }
}
