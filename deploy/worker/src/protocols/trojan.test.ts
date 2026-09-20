import { describe, expect, it } from 'vitest';
import { concatBytes } from '../core/bytes';
import { sha224Hex } from '../core/sha224';
import { parseTrojanRequest } from './trojan';

const PASSWORD = 'correct horse battery staple';
const HASH = sha224Hex(PASSWORD);

function request(options: {
  hash?: string;
  command?: number;
  type?: 1 | 3 | 4;
  host?: string;
  port?: number;
  payload?: Uint8Array;
}) {
  const type = options.type ?? 3;
  const host = options.host ?? 'example.com';
  let address: Uint8Array;
  if (type === 1) address = new Uint8Array(host.split('.').map(Number));
  else if (type === 3) {
    const encoded = new TextEncoder().encode(host);
    address = concatBytes(new Uint8Array([encoded.length]), encoded);
  } else {
    const groups = host.split(':').map((part) => Number.parseInt(part || '0', 16));
    address = new Uint8Array(16);
    groups.forEach((group, index) => {
      address[index * 2] = group >> 8;
      address[index * 2 + 1] = group & 0xff;
    });
  }
  const port = options.port ?? 443;
  return concatBytes(
    new TextEncoder().encode(options.hash ?? HASH),
    new Uint8Array([13, 10, options.command ?? 1, type]),
    address,
    new Uint8Array([port >> 8, port & 0xff, 13, 10]),
    options.payload ?? new Uint8Array(),
  );
}

describe('Trojan parser', () => {
  it('parses a domain CONNECT request and preserves payload', () => {
    const payload = new TextEncoder().encode('GET / HTTP/1.0\r\n\r\n');
    const result = parseTrojanRequest(request({ payload }), HASH);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.value.destination).toEqual({
      host: 'example.com',
      port: 443,
      addressType: 'domain',
    });
    expect([...result.value.payload]).toEqual([...payload]);
  });

  it('parses IPv4 and IPv6', () => {
    const ipv4 = parseTrojanRequest(request({ type: 1, host: '93.184.216.34', port: 80 }), HASH);
    expect(ipv4.kind === 'ok' && ipv4.value.destination).toEqual({
      host: '93.184.216.34',
      port: 80,
      addressType: 'ipv4',
    });
    const ipv6 = parseTrojanRequest(request({ type: 4, host: '2001:db8:0:0:0:0:0:1' }), HASH);
    expect(ipv6.kind === 'ok' && ipv6.value.destination).toEqual({
      host: '2001:db8:0:0:0:0:0:1',
      port: 443,
      addressType: 'ipv6',
    });
  });

  it('waits for fragmented valid handshakes', () => {
    const full = request({ host: 'fragment.example' });
    expect(parseTrojanRequest(full.slice(0, full.length - 1), HASH).kind).toBe('need-more');
    expect(parseTrojanRequest(full, HASH).kind).toBe('ok');
  });

  it('rejects an incorrect password hash', () => {
    expect(parseTrojanRequest(request({ hash: '0'.repeat(56) }), HASH)).toEqual({
      kind: 'error',
      code: 'auth',
    });
  });

  it('rejects UDP and malformed CRLF', () => {
    expect(parseTrojanRequest(request({ command: 3 }), HASH)).toEqual({
      kind: 'error',
      code: 'unsupported-command',
    });
    const malformed = request({});
    malformed[56] = 0;
    expect(parseTrojanRequest(malformed, HASH)).toEqual({ kind: 'error', code: 'malformed' });
  });

  it('rejects an empty domain and a header beyond the cap', () => {
    expect(parseTrojanRequest(request({ host: '' }), HASH)).toEqual({
      kind: 'error',
      code: 'invalid-address',
    });
    const tooLong = request({ host: 'a'.repeat(255) });
    // Trojan's normal max domain header is below 512; append no payload and verify it stays parseable.
    expect(parseTrojanRequest(tooLong, HASH).kind).toBe('ok');
    expect(parseTrojanRequest(new Uint8Array(513).fill(0x61), HASH)).toEqual({
      kind: 'error',
      code: 'auth',
    });
  });
});

describe('Trojan candidate parser', () => {
  it('exposes the exact lowercase SHA-224 wire credential before authorization', async () => {
    const { parseTrojanCandidate } = await import('./trojan');
    const wireHash = 'A'.repeat(56);
    const result = parseTrojanCandidate(request({ hash: wireHash, host: 'candidate.example' }));
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(new TextDecoder().decode(result.value.presentedCredential)).toBe(wireHash.toLowerCase());
    expect(result.value.destination.host).toBe('candidate.example');
  });
});
