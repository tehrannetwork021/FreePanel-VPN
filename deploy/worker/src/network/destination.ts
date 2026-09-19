import type { Destination } from '../core/types';

export type DestinationValidation = { ok: true } | { ok: false; reason: string };

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isBlockedIpv4(ip: number[]): boolean {
  const [a, b] = ip;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b! >= 64 && b! <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b! >= 16 && b! <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a! >= 224) return true;
  return false;
}

function firstIpv6Hextet(host: string): number | null {
  if (!host.includes(':')) return null;
  const first = host.split(':', 1)[0];
  if (host === '::' || host === '::1') return 0;
  if (!first || !/^[0-9a-f]{1,4}$/i.test(first)) return null;
  return Number.parseInt(first, 16);
}

function isBlockedIpv6(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  const first = firstIpv6Hextet(normalized);
  if (first === null) return false;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((first & 0xff00) === 0xff00) return true; // multicast
  return false;
}

export function validateDestination(
  destination: Destination,
  selfHost: string,
): DestinationValidation {
  const host = normalizeHost(destination.host);
  const self = normalizeHost(selfHost);
  if (!host || host.length > 253) return { ok: false, reason: 'invalid-host' };
  if (!Number.isInteger(destination.port) || destination.port < 1 || destination.port > 65535) {
    return { ok: false, reason: 'invalid-port' };
  }
  if (host === self) return { ok: false, reason: 'self-destination' };
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return { ok: false, reason: 'local-domain' };
  }
  const ipv4 = parseIpv4(host);
  if (ipv4 && isBlockedIpv4(ipv4)) return { ok: false, reason: 'private-ipv4' };
  if (host.includes(':') && isBlockedIpv6(host)) return { ok: false, reason: 'private-ipv6' };
  return { ok: true };
}
