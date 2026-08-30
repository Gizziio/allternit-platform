/**
 * Clerk Frontend API proxy for allternit.com.
 *
 * Proxies all Clerk FAPI traffic through the app domain so session cookies
 * stay first-party and sign-in works on browsers that block third-party
 * cookies across subdomains.
 *
 * Route: allternit.com/__clerk/* -> https://clerk.allternit.com/*
 */

const FAPI_ORIGIN = 'https://clerk.allternit.com';
const PROXY_PATH_PREFIX = '/__clerk';
const CLERK_PROXY_URL = 'https://allternit.com/__clerk';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only proxy paths under /__clerk
    if (!url.pathname.startsWith(PROXY_PATH_PREFIX)) {
      return new Response('Not found', { status: 404 });
    }

    const targetPath = url.pathname.slice(PROXY_PATH_PREFIX.length) || '/';
    const targetUrl = `${FAPI_ORIGIN}${targetPath}${url.search}`;

    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.delete('host');
    proxyHeaders.set('Clerk-Proxy-Url', CLERK_PROXY_URL);
    proxyHeaders.set('Clerk-Secret-Key', env.CLERK_SECRET_KEY);

    const clientIp = request.headers.get('CF-Connecting-IP') || '';
    if (clientIp) {
      proxyHeaders.set('X-Forwarded-For', clientIp);
    }

    const proxyReq = new Request(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.body,
      redirect: 'manual',
    });

    const response = await fetch(proxyReq);

    const requestOrigin = request.headers.get('origin') || url.origin;
    const corsHeaders = new Headers(response.headers);
    corsHeaders.set('Access-Control-Allow-Origin', requestOrigin);
    corsHeaders.set('Access-Control-Allow-Credentials', 'true');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: corsHeaders,
    });
  },
};
