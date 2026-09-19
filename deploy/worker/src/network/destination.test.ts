import { describe, expect, it } from 'vitest';
import { validateDestination } from './destination';

const d = (host: string, port = 443, addressType: 'domain' | 'ipv4' | 'ipv6' = 'domain') => ({
  host,
  port,
  addressType,
});

describe('destination policy', () => {
  it('allows ordinary public domains and addresses', () => {
    expect(validateDestination(d('example.com'), 'edge.example.workers.dev')).toEqual({ ok: true });
    expect(validateDestination(d('93.184.216.34', 80, 'ipv4'), 'edge.example.workers.dev')).toEqual(
      { ok: true },
    );
    expect(
      validateDestination(d('2001:4860:4860::8888', 53, 'ipv6'), 'edge.example.workers.dev'),
    ).toEqual({ ok: true });
  });

  it.each([
    ['localhost', 'domain'],
    ['api.localhost', 'domain'],
    ['127.0.0.1', 'ipv4'],
    ['10.1.2.3', 'ipv4'],
    ['172.16.5.4', 'ipv4'],
    ['172.31.255.1', 'ipv4'],
    ['192.168.1.2', 'ipv4'],
    ['169.254.1.1', 'ipv4'],
    ['0.0.0.0', 'ipv4'],
    ['::1', 'ipv6'],
    ['::', 'ipv6'],
    ['fc00::1', 'ipv6'],
    ['fd12::1', 'ipv6'],
    ['fe80::1', 'ipv6'],
  ] as const)('rejects private or local destination %s', (host, addressType) => {
    expect(validateDestination(d(host, 443, addressType), 'edge.example.workers.dev').ok).toBe(
      false,
    );
  });

  it('rejects the Worker itself and invalid ports', () => {
    expect(validateDestination(d('EDGE.EXAMPLE.WORKERS.DEV.'), 'edge.example.workers.dev').ok).toBe(
      false,
    );
    expect(validateDestination(d('example.com', 0), 'edge.example.workers.dev').ok).toBe(false);
    expect(validateDestination(d('example.com', 65536), 'edge.example.workers.dev').ok).toBe(false);
  });
});
