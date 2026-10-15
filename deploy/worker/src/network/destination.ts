import type { Destination } from '../core/types';

export type DestinationValidation = { ok: true } | { ok: false; reason: string };

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

function canonicalHost(host: string): string | null {
  // Only accept a host, never URL syntax, credentials, a port, or a zone ID.
  if (!/^[a-z0-9.:-]+$/iu.test(host)) return null;
  try {
    return new URL(`http://${host.includes(':') ? `[${host}]` : host}/`).hostname.replace(
      /^\[|\]$/gu,
      '',
    );
  } catch {
    return null;
  }
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
  // WHATWG URL normalizes dotted mapped IPv4 into two hex hextets.
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(normalized);
  if (mapped) {
    const high = Number.parseInt(mapped[1]!, 16);
    const low = Number.parseInt(mapped[2]!, 16);
    return isBlockedIpv4([high >> 8, high & 255, low >> 8, low & 255]);
  }
  if (normalized.startsWith('::')) return true; // deprecated IPv4-compatible / reserved range
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
  const rawHost = normalizeHost(destination.host);
  const host = canonicalHost(rawHost);
  const self = canonicalHost(normalizeHost(selfHost));
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
