import { constantTimeEqual } from '../core/bytes';
import type { Destination, ParseResult } from '../core/types';
import { formatIpv6, uuidToBytes } from '../core/uuid';

const MAX_HEADER_BYTES = 512;
const VERSION = 0;
const COMMAND_TCP = 1;

export type ParsedVlessCandidate = {
  presentedCredential: Uint8Array;
  destination: Destination;
  payload: Uint8Array;
  responseHeader: Uint8Array;
};

type ParsedVlessRequest = Omit<ParsedVlessCandidate, 'presentedCredential'>;
const needMore = <T>(): ParseResult<T> => ({ kind: 'need-more' });
const fail = <T>(code: string): ParseResult<T> => ({ kind: 'error', code });

export function parseVlessCandidate(input: Uint8Array): ParseResult<ParsedVlessCandidate> {
  if (input.length < 18) return needMore();
  if (input[0] !== VERSION) return fail('unsupported-version');
  const presentedCredential = input.slice(1, 17);
  const addonsLength = input[17]!;
  let offset = 18 + addonsLength;
  if (offset + 4 > MAX_HEADER_BYTES) return fail('header-too-large');
  if (input.length < offset + 4) return needMore();
  const command = input[offset]!;
  if (command !== COMMAND_TCP) return fail('unsupported-command');
  const port = (input[offset + 1]! << 8) | input[offset + 2]!;
  const addressType = input[offset + 3]!;
  offset += 4;
  if (port === 0) return fail('invalid-port');

  let destination: Destination;
  if (addressType === 1) {
    if (offset + 4 > MAX_HEADER_BYTES) return fail('header-too-large');
    if (input.length < offset + 4) return needMore();
    destination = {
      host: [...input.subarray(offset, offset + 4)].join('.'),
      port,
      addressType: 'ipv4',
    };
    offset += 4;
  } else if (addressType === 2) {
    if (input.length < offset + 1) return needMore();
    const length = input[offset]!;
    if (length === 0) return fail('invalid-address');
    offset += 1;
    if (offset + length > MAX_HEADER_BYTES) return fail('header-too-large');
    if (input.length < offset + length) return needMore();
    try {
      const host = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
        input.subarray(offset, offset + length),
      );
      if (!host) return fail('invalid-address');
      destination = { host, port, addressType: 'domain' };
    } catch {
      return fail('invalid-address');
    }
    offset += length;
  } else if (addressType === 3) {
    if (offset + 16 > MAX_HEADER_BYTES) return fail('header-too-large');
    if (input.length < offset + 16) return needMore();
    destination = {
      host: formatIpv6(input.subarray(offset, offset + 16)),
      port,
      addressType: 'ipv6',
    };
    offset += 16;
  } else {
    return fail('invalid-address-type');
  }

  if (offset > MAX_HEADER_BYTES) return fail('header-too-large');
  return {
    kind: 'ok',
    value: {
      presentedCredential,
      destination,
      payload: input.slice(offset),
      responseHeader: new Uint8Array([VERSION, 0]),
    },
  };
}

export function parseVlessRequest(
  input: Uint8Array,
  expectedUuid: string,
): ParseResult<ParsedVlessRequest> {
  if (input.length < 18) return needMore();
  if (input[0] !== VERSION) return fail('unsupported-version');
  let expected: Uint8Array;
  try {
    expected = uuidToBytes(expectedUuid);
  } catch {
    return fail('config');
  }
  if (!constantTimeEqual(input.subarray(1, 17), expected)) return fail('auth');
  const candidate = parseVlessCandidate(input);
  if (candidate.kind !== 'ok') return candidate;
  return {
    kind: 'ok',
    value: {
      destination: candidate.value.destination,
      payload: candidate.value.payload,
      responseHeader: candidate.value.responseHeader,
    },
  };
}
