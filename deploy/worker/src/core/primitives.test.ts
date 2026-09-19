import { describe, expect, it } from 'vitest';
import { constantTimeEqual, toBytes } from './bytes';
import { formatIpv6, uuidToBytes } from './uuid';

describe('protocol primitives', () => {
  it('converts UUID text to the exact 16 protocol bytes', () => {
    expect([...uuidToBytes('27848739-7e62-4138-9fd3-098a63964b6b')]).toEqual([
      0x27, 0x84, 0x87, 0x39, 0x7e, 0x62, 0x41, 0x38, 0x9f, 0xd3, 0x09, 0x8a, 0x63, 0x96, 0x4b,
      0x6b,
    ]);
  });

  it('compares byte credentials without early length shortcuts in the API', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(constantTimeEqual(new Uint8Array([1]), new Uint8Array([1, 0]))).toBe(false);
  });

  it('normalizes supported binary inputs and IPv6 bytes', () => {
    expect([...toBytes(new Uint8Array([4, 5]))]).toEqual([4, 5]);
    expect([...toBytes(new Uint8Array([6, 7]).buffer)]).toEqual([6, 7]);
    expect(
      formatIpv6(new Uint8Array([0x20, 1, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])),
    ).toBe('2001:db8:0:0:0:0:0:1');
  });
});
