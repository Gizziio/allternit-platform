import { describe, expect, it } from 'vitest';
import {
  classifyTarget,
  isLocalhostHost,
  isPrivateOrReservedAddress,
  normalizeHostname,
  parseHostPermission,
} from './mini-app-policy-proxy.js';

describe('normalizeHostname', () => {
  it('lowercases, trims, and strips trailing dots and brackets', () => {
    expect(normalizeHostname('  API.Example.COM. ')).toBe('api.example.com');
    expect(normalizeHostname('[::1]')).toBe('::1');
    expect(normalizeHostname('LOCALHOST')).toBe('localhost');
  });
});

describe('parseHostPermission', () => {
  it('parses hostnames with and without ports', () => {
    expect(parseHostPermission('api.example.com')).toEqual({ host: 'api.example.com', port: undefined });
    expect(parseHostPermission('API.Example.com:8443')).toEqual({ host: 'api.example.com', port: 8443 });
  });

  it('rejects invalid entries', () => {
    expect(parseHostPermission('')).toBeNull();
    expect(parseHostPermission('host:0')).toBeNull();
    expect(parseHostPermission('host:70000')).toBeNull();
    expect(parseHostPermission('host:notaport')).toBeNull();
    expect(parseHostPermission('http://host')).toBeNull();
  });
});

describe('isLocalhostHost', () => {
  it('recognizes loopback names and addresses', () => {
    expect(isLocalhostHost('localhost')).toBe(true);
    expect(isLocalhostHost('foo.localhost')).toBe(true);
    expect(isLocalhostHost('127.0.0.1')).toBe(true);
    expect(isLocalhostHost('127.0.0.53')).toBe(true);
    expect(isLocalhostHost('::1')).toBe(true);
  });

  it('rejects public hosts', () => {
    expect(isLocalhostHost('example.com')).toBe(false);
    expect(isLocalhostHost('128.0.0.1')).toBe(false);
    expect(isLocalhostHost('localhost.evil.com')).toBe(false);
  });
});

describe('isPrivateOrReservedAddress', () => {
  it('flags loopback, private, link-local, CGNAT, and unspecified addresses', () => {
    for (const address of [
      '0.0.0.0', '10.0.0.1', '127.0.0.1', '100.64.0.1', '169.254.1.1',
      '172.16.0.1', '172.31.255.1', '192.168.1.1', '192.0.0.1', '198.18.0.1',
      '224.0.0.1', '255.255.255.255', '::', '::1', 'fd00::1', 'fe80::1',
      '::ffff:127.0.0.1', '::ffff:10.1.2.3',
    ]) {
      expect(isPrivateOrReservedAddress(address), address).toBe(true);
    }
  });

  it('passes public addresses', () => {
    for (const address of ['8.8.8.8', '1.1.1.1', '203.0.113.1'.replace('203.0.113', '203.0.114'), '93.184.216.34', '2606:4700:4700::1111']) {
      expect(isPrivateOrReservedAddress(address), address).toBe(false);
    }
  });
});

describe('classifyTarget', () => {
  const allowedHosts = ['api.example.com', 'cdn.example.com:8443'];

  it('allows approved hosts on any port unless the entry pins a port', () => {
    expect(classifyTarget('api.example.com', 443, allowedHosts).allowed).toBe(true);
    expect(classifyTarget('api.example.com', 80, allowedHosts).allowed).toBe(true);
    expect(classifyTarget('cdn.example.com', 8443, allowedHosts).allowed).toBe(true);
    expect(classifyTarget('cdn.example.com', 443, allowedHosts).allowed).toBe(false);
  });

  it('normalizes case and trailing dots before matching', () => {
    expect(classifyTarget('API.Example.COM.', 443, allowedHosts).allowed).toBe(true);
  });

  it('denies unlisted hosts and subdomains of listed hosts', () => {
    expect(classifyTarget('evil.com', 443, allowedHosts).allowed).toBe(false);
    expect(classifyTarget('sub.api.example.com', 443, allowedHosts).allowed).toBe(false);
    expect(classifyTarget('api.example.com.evil.com', 443, allowedHosts).allowed).toBe(false);
  });

  it('handles localhost only through the approved port list', () => {
    expect(classifyTarget('localhost', 3000, allowedHosts, [3000]).allowed).toBe(true);
    expect(classifyTarget('127.0.0.1', 3000, allowedHosts, [3000]).allowed).toBe(true);
    expect(classifyTarget('localhost', 3001, allowedHosts, [3000]).allowed).toBe(false);
    expect(classifyTarget('::1', 3001, allowedHosts, []).allowed).toBe(false);
  });
});
