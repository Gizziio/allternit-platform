/**
 * Loopback enforcement for local model runtimes.
 *
 * Local-first means prompts and weights never leave the device. A runtime
 * endpoint that is not loopback (for example a misconfigured OLLAMA_HOST
 * pointing at a remote server) must fail loudly instead of silently sending
 * user data to a network host.
 */

const LOOPBACK_HOSTNAMES = new Set(["localhost", "ip6-localhost"]);

export function isLoopbackUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (LOOPBACK_HOSTNAMES.has(host) || host.endsWith(".localhost")) return true;
  if (host === "::1" || host === "[::1]" || host === "0:0:0:0:0:0:0:1") return true;

  // Any 127.0.0.0/8 address is loopback.
  const octets = host.split(".");
  if (
    octets.length === 4 &&
    octets[0] === "127" &&
    octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
  ) {
    return true;
  }

  return false;
}

export function assertLoopbackUrl(rawUrl: string, label: string): string {
  if (!isLoopbackUrl(rawUrl)) {
    throw new Error(
      `${label} must use a loopback URL (http://127.0.0.1 or http://localhost); got "${rawUrl}". ` +
        "Local-first mode never sends prompts or model data to a network host. " +
        "If you intentionally run this runtime on another machine, opt in explicitly.",
    );
  }
  return rawUrl;
}
