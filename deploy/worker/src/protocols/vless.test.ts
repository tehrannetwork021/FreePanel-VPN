import { describe, expect, it } from 'vitest';
import { concatBytes } from '../core/bytes';
import { uuidToBytes } from '../core/uuid';
import { parseVlessRequest } from './vless';

const UUID = '27848739-7e62-4138-9fd3-098a63964b6b';
const OTHER = '11111111-2222-4333-8444-555555555555';

function request(options: {
  uuid?: string;
  command?: number;
  port?: number;
  type?: 1 | 2 | 3;
  host?: string;
  addons?: Uint8Array;
  payload?: Uint8Array;
}) {
  const addons = options.addons ?? new Uint8Array();
  const type = options.type ?? 2;
  const host = options.host ?? 'example.com';
  let address: Uint8Array;
  if (type === 1) address = new Uint8Array(host.split('.').map(Number));
  else if (type === 2) {
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
    new Uint8Array([0]),
    uuidToBytes(options.uuid ?? UUID),
    new Uint8Array([addons.length]),
    addons,
    new Uint8Array([options.command ?? 1, port >> 8, port & 0xff, type]),
    address,
    options.payload ?? new Uint8Array(),
  );
}

describe('VLESS parser', () => {
  it('parses a domain TCP request and preserves initial payload', () => {
    const payload = new TextEncoder().encode('GET / HTTP/1.0\r\n\r\n');
    const result = parseVlessRequest(request({ payload }), UUID);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.value.destination).toEqual({
      host: 'example.com',
      port: 443,
      addressType: 'domain',
    });
    expect([...result.value.payload]).toEqual([...payload]);
    expect([...result.value.responseHeader]).toEqual([0, 0]);
  });

  it('parses IPv4, IPv6 and non-empty addons', () => {
    const ipv4 = parseVlessRequest(
      request({ type: 1, host: '93.184.216.34', port: 80, addons: new Uint8Array([1, 2]) }),
      UUID,
    );
    expect(ipv4.kind === 'ok' && ipv4.value.destination).toEqual({
      host: '93.184.216.34',
      port: 80,
      addressType: 'ipv4',
    });

    const ipv6 = parseVlessRequest(request({ type: 3, host: '2001:db8:0:0:0:0:0:1' }), UUID);
    expect(ipv6.kind === 'ok' && ipv6.value.destination).toEqual({
      host: '2001:db8:0:0:0:0:0:1',
      port: 443,
      addressType: 'ipv6',
    });
  });

  it('waits for a fragmented valid header', () => {
    const full = request({ host: 'fragment.example' });
    expect(parseVlessRequest(full.slice(0, full.length - 1), UUID).kind).toBe('need-more');
    expect(parseVlessRequest(full, UUID).kind).toBe('ok');
  });

  it('rejects a wrong UUID before producing a destination', () => {
    const result = parseVlessRequest(request({ uuid: OTHER }), UUID);
    expect(result).toEqual({ kind: 'error', code: 'auth' });
  });

  it.each([2, 3])('rejects unsupported command %s', (command) => {
    const result = parseVlessRequest(request({ command }), UUID);
    expect(result).toEqual({ kind: 'error', code: 'unsupported-command' });
  });

  it('rejects zero-length domains and a header that would exceed the cap', () => {
    const emptyDomain = request({ host: '' });
    expect(parseVlessRequest(emptyDomain, UUID)).toEqual({
      kind: 'error',
      code: 'invalid-address',
    });

    const huge = request({ host: 'a'.repeat(255), addons: new Uint8Array(255) });
    expect(parseVlessRequest(huge, UUID)).toEqual({ kind: 'error', code: 'header-too-large' });
  });

  it('rejects an unknown address type and unsupported protocol version', () => {
    const unknown = request({});
    unknown[21] = 9;
    expect(parseVlessRequest(unknown, UUID)).toEqual({
      kind: 'error',
      code: 'invalid-address-type',
    });

    const version = request({});
    version[0] = 1;
    expect(parseVlessRequest(version, UUID)).toEqual({
      kind: 'error',
      code: 'unsupported-version',
    });
  });
});

describe('VLESS candidate parser', () => {
  it('exposes the presented UUID bytes without authorizing them', async () => {
    const { parseVlessCandidate } = await import('./vless');
    const packet = request({
      uuid: OTHER,
      host: 'candidate.example',
      payload: new Uint8Array([9]),
    });
    const result = parseVlessCandidate(packet);
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect([...result.value.presentedCredential]).toEqual([...uuidToBytes(OTHER)]);
    expect(result.value.destination.host).toBe('candidate.example');
    expect([...result.value.payload]).toEqual([9]);
  });
});
