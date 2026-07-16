/**
 * Allternit policy proxy — per-hostname network enforcement for mini-apps.
 *
 * Community runtimes never get direct outbound network access when they
 * declare network permissions. Instead:
 *
 *   1. The sandbox profile (macOS) allows loopback TCP only and blocks DNS —
 *      see `mini-app-sandbox.ts` (verified empirically: external connects fail
 *      with EPERM at the syscall, no packet leaves the host).
 *   2. The runtime receives HTTP_PROXY/HTTPS_PROXY environment variables
 *      pointing at this proxy, which listens on 127.0.0.1 with an ephemeral
 *      port and a per-session random credential.
 *   3. The proxy resolves hostnames itself (outside the sandbox), checks each
 *      target against the approved permission list, pins the resolved address
 *      for the connection, and refuses names that resolve to private or
 *      reserved addresses (DNS rebinding defense).
 *
 * HTTP redirects are never followed by the proxy: the client receives the 3xx
 * and re-requests through the proxy, so the redirect target is re-classified
 * against the allowlist.
 *
 * Logging is decision-only: method, host, port, and allow/deny with reason.
 * Request headers, proxy credentials, and URL query strings are never logged
 * (they can carry authorization tokens and secrets).
 *
 * Runtimes whose HTTP stacks ignore proxy environment variables simply fail
 * closed: the sandbox blocks their external traffic.
 */

import * as http from 'node:http';
import * as net from 'node:net';
import * as dns from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import type { AddressInfo } from 'node:net';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import log from 'electron-log';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MiniAppPolicyProxyOptions {
  appId: string;
  /** Approved hostnames from the manifest (exact match, optional :port). */
  allowedHosts: string[];
  /** Loopback ports the runtime may reach through the proxy. */
  allowedLocalhostPorts?: number[];
}

export interface MiniAppPolicyProxy {
  /** Loopback port the proxy listens on. */
  port: number;
  /** Proxy URL including the per-session credential. Never log this value. */
  proxyUrl: string;
  /** Environment entries to inject into the sandboxed runtime. */
  environment: Record<string, string>;
  close(): Promise<void>;
}

export interface TargetVerdict {
  allowed: boolean;
  reason: string;
}

// ─── Pure classification helpers (unit-test targets) ─────────────────────────

export function normalizeHostname(value: string): string {
  let host = value.trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  while (host.endsWith('.')) host = host.slice(0, -1);
  return host;
}

/** Parse a manifest network entry: `hostname` or `hostname:port`. */
export function parseHostPermission(entry: string): { host: string; port?: number } | null {
  const trimmed = entry.trim();
  const bracket = /^\[([0-9a-fA-F:]+)\](?::(\d{1,5}))?$/.exec(trimmed);
  if (bracket) {
    const port = bracket[2] ? Number(bracket[2]) : undefined;
    if (port !== undefined && (port < 1 || port > 65535)) return null;
    return { host: normalizeHostname(bracket[1]), port };
  }
  const match = /^([A-Za-z0-9._-]{1,253})(?::(\d{1,5}))?$/.exec(trimmed);
  if (!match) return null;
  const port = match[2] ? Number(match[2]) : undefined;
  if (port !== undefined && (port < 1 || port > 65535)) return null;
  return { host: normalizeHostname(match[1]), port };
}

export function isLocalhostHost(host: string): boolean {
  const normalized = normalizeHostname(host);
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true;
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  return /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

/**
 * Loopback, private, link-local, CGNAT, documentation, multicast, and
 * unspecified addresses. A public hostname resolving to any of these is
 * treated as a DNS rebinding attempt.
 */
export function isPrivateOrReservedAddress(address: string): boolean {
  const ip = normalizeHostname(address);
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    const [a, b, c] = [Number(v4[1]), Number(v4[2]), Number(v4[3])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    // Reserved blocks are /24s, not the whole /16s: 192.0.0.0/24 is IETF
    // Protocol Assignments; 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 are
    // the RFC 5737 documentation ranges. Other 192.0.x/198.51.x/203.0.x space
    // is legitimately routed (e.g. IANA anycast) and must stay reachable.
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
    if (a >= 224) return true;
    return false;
  }
  if (ip === '::' || ip === '::1') return true;
  if (ip.startsWith('::ffff:')) return isPrivateOrReservedAddress(ip.slice(7));
  const first = ip.split(':')[0];
  if (/^f[cd][0-9a-f]{2}$/i.test(first) || first === 'fc' || first === 'fd') return true;
  if (/^fe[89ab][0-9a-f]{2}$/i.test(first) || first === 'fe80') return true;
  if (first.startsWith('ff')) return true;
  return false;
}

export function classifyTarget(
  host: string,
  port: number,
  allowedHosts: string[],
  allowedLocalhostPorts: number[] = [],
): TargetVerdict {
  const normalized = normalizeHostname(host);
  if (!normalized) return { allowed: false, reason: 'empty hostname' };
  if (isLocalhostHost(normalized)) {
    return allowedLocalhostPorts.includes(port)
      ? { allowed: true, reason: 'approved localhost port' }
      : { allowed: false, reason: `localhost port ${port} is not in the approved list` };
  }
  for (const entry of allowedHosts) {
    const permission = parseHostPermission(entry);
    if (!permission) continue;
    if (permission.host !== normalized) continue;
    if (permission.port !== undefined && permission.port !== port) continue;
    return { allowed: true, reason: permission.port !== undefined ? 'approved host:port' : 'approved host' };
  }
  return { allowed: false, reason: 'host is not in the approved network permission list' };
}

// ─── Proxy implementation ─────────────────────────────────────────────────────

const CONNECT_IDLE_TIMEOUT_MS = 120_000;
const DNS_LOOKUP_TIMEOUT_MS = 10_000;

function hopByHopStripped(headers: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
  const cleaned: http.OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(headers)) {
    if (['proxy-authorization', 'proxy-connection', 'connection', 'keep-alive', 'te', 'trailer', 'transfer-encoding', 'upgrade'].includes(name)) continue;
    cleaned[name] = value;
  }
  return cleaned;
}

export async function startMiniAppPolicyProxy(options: MiniAppPolicyProxyOptions): Promise<MiniAppPolicyProxy> {
  const { appId } = options;
  const allowedHosts = options.allowedHosts || [];
  const allowedLocalhostPorts = options.allowedLocalhostPorts || [];
  const token = randomBytes(24).toString('base64url');
  const expectedCredential = Buffer.from(`allternit:${token}`, 'utf8');
  const sockets = new Set<net.Socket>();

  const logger = (message: string): void => log.info(`[policy-proxy:${appId}] ${message}`);

  const authorized = (req: http.IncomingMessage): boolean => {
    const header = req.headers['proxy-authorization'] || '';
    if (!header.startsWith('Basic ')) return false;
    const decoded = Buffer.from(header.slice('Basic '.length), 'base64');
    return decoded.length === expectedCredential.length && timingSafeEqual(decoded, expectedCredential);
  };

  /**
   * Resolve a public hostname once and pin the address for this connection.
   * Rejects names resolving to private/reserved addresses (rebinding defense)
   * and never re-resolves for the lifetime of the connection.
   */
  const resolveAndPin = async (host: string): Promise<{ address?: string; error?: string }> => {
    let addresses: LookupAddress[];
    try {
      addresses = await Promise.race([
        dns.lookup(host, { all: true, verbatim: true }),
        new Promise<LookupAddress[]>((_, reject) => {
          setTimeout(() => reject(new Error('DNS lookup timed out')), DNS_LOOKUP_TIMEOUT_MS);
        }),
      ]);
    } catch (error) {
      return { error: `DNS resolution failed: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (!addresses.length) return { error: 'DNS returned no addresses' };
    if (addresses.some((entry) => isPrivateOrReservedAddress(entry.address))) {
      return { error: 'hostname resolves to a private or reserved address (possible DNS rebinding)' };
    }
    return { address: addresses[0].address };
  };

  const requireAuth = (req: http.IncomingMessage, reject: () => void): boolean => {
    if (authorized(req)) return true;
    logger('deny  (missing or invalid proxy credential)');
    reject();
    return false;
  };

  const server = http.createServer();

  // Plain-HTTP forward proxying. Redirects are returned to the client, which
  // re-requests through the proxy — so redirect targets are re-classified.
  server.on('request', async (req, res) => {
    if (!requireAuth(req, () => {
      res.writeHead(407, { 'proxy-authenticate': 'Basic realm="allternit-policy-proxy"' });
      res.end();
    })) return;

    let target: URL;
    try {
      target = new URL(req.url || '/', `http://${req.headers.host || ''}`);
    } catch {
      res.writeHead(400); res.end();
      return;
    }
    if (target.protocol !== 'http:') {
      res.writeHead(400); res.end();
      return;
    }
    const host = target.hostname;
    const port = Number(target.port) || 80;
    const verdict = classifyTarget(host, port, allowedHosts, allowedLocalhostPorts);
    if (!verdict.allowed) {
      logger(`deny  ${req.method} ${host}:${port} (${verdict.reason})`);
      res.writeHead(403); res.end();
      return;
    }
    const local = isLocalhostHost(host);
    const pinned = local ? { address: host === 'localhost' ? '127.0.0.1' : host } : await resolveAndPin(host);
    if (!pinned.address) {
      logger(`deny  ${req.method} ${host}:${port} (${pinned.error})`);
      res.writeHead(502); res.end();
      return;
    }
    logger(`allow ${req.method} ${host}:${port}${target.pathname} (${verdict.reason})`);
    const upstream = http.request({
      host: pinned.address,
      port,
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers: { ...hopByHopStripped(req.headers), host: target.host },
      agent: false,
    });
    upstream.on('response', (upstreamResponse) => {
      logger(`      ${req.method} ${host}:${port} -> ${upstreamResponse.statusCode}`);
      res.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  });

  // HTTPS tunneling via CONNECT.
  server.on('connect', (req, clientSocket, head) => {
    void (async () => {
      const socket = clientSocket as net.Socket;
      if (!requireAuth(req, () => {
        socket.end('HTTP/1.1 407 Proxy Authentication Required\r\nproxy-authenticate: Basic realm="allternit-policy-proxy"\r\n\r\n');
      })) return;

      const authority = /^(.+):(\d{1,5})$/.exec(req.url || '');
      const host = authority ? normalizeHostname(authority[1]) : '';
      const port = authority ? Number(authority[2]) : 0;
      if (!host || !port) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }
      const verdict = classifyTarget(host, port, allowedHosts, allowedLocalhostPorts);
      if (!verdict.allowed) {
        logger(`deny  CONNECT ${host}:${port} (${verdict.reason})`);
        socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        return;
      }
      const local = isLocalhostHost(host);
      const pinned = local ? { address: host === 'localhost' ? '127.0.0.1' : host } : await resolveAndPin(host);
      if (!pinned.address) {
        logger(`deny  CONNECT ${host}:${port} (${pinned.error})`);
        socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        return;
      }
      logger(`allow CONNECT ${host}:${port} (${verdict.reason})`);
      const upstream = net.connect({ host: pinned.address, port });
      upstream.setTimeout(CONNECT_IDLE_TIMEOUT_MS);
      socket.setTimeout(CONNECT_IDLE_TIMEOUT_MS);
      upstream.on('connect', () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head?.length) upstream.write(head);
        upstream.pipe(socket);
        socket.pipe(upstream);
      });
      const tearDown = (): void => {
        upstream.destroy();
        socket.destroy();
      };
      upstream.on('error', () => {
        socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        tearDown();
      });
      upstream.on('timeout', tearDown);
      socket.on('error', tearDown);
      socket.on('timeout', tearDown);
    })();
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('secureConnection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('clientError', (error, socket) => {
    logger(`client error: ${error.message}`);
    socket.destroy();
  });
  server.maxConnections = 256;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  const proxyUrl = `http://allternit:${token}@127.0.0.1:${port}`;
  logger(`listening on 127.0.0.1:${port} with ${allowedHosts.length} approved host(s)`);

  return {
    port,
    proxyUrl,
    environment: {
      HTTP_PROXY: proxyUrl,
      HTTPS_PROXY: proxyUrl,
      http_proxy: proxyUrl,
      https_proxy: proxyUrl,
      NO_PROXY: 'localhost,127.0.0.1,::1',
      no_proxy: 'localhost,127.0.0.1,::1',
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
        server.closeAllConnections?.();
        setTimeout(resolve, 1_000).unref();
      }),
  };
}
