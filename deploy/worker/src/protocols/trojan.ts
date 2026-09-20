import { constantTimeEqual } from '../core/bytes';
import type { Destination, ParseResult } from '../core/types';
import { formatIpv6 } from '../core/uuid';

const MAX_HEADER_BYTES = 512;
const HASH_LENGTH = 56;
const CONNECT = 1;

export type ParsedTrojanCandidate = {
  presentedCredential: Uint8Array;
  destination: Destination;
  payload: Uint8Array;
};

type ParsedTrojanRequest = Omit<ParsedTrojanCandidate, 'presentedCredential'>;
const fail = <T>(code: string): ParseResult<T> => ({ kind: 'error', code });
const needMore = <T>(): ParseResult<T> => ({ kind: 'need-more' });

function asciiBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text.toLowerCase());
}

export function parseTrojanCandidate(input: Uint8Array): ParseResult<ParsedTrojanCandidate> {
  if (input.length < HASH_LENGTH + 2) return needMore();
  const rawCredential = input.subarray(0, HASH_LENGTH);
  const credentialText = new TextDecoder().decode(rawCredential).toLowerCase();
  if (!/^[0-9a-f]{56}$/u.test(credentialText)) return fail('auth');
  const presentedCredential = new TextEncoder().encode(credentialText);
  if (input[56] !== 13 || input[57] !== 10) return fail('malformed');
  let offset = 58;
  if (input.length < offset + 2) return needMore();
  const command = input[offset]!;
  if (command !== CONNECT) return fail('unsupported-command');
  const addressType = input[offset + 1]!;
  offset += 2;

  let destination: Destination;
  if (addressType === 1) {
    if (offset + 4 > MAX_HEADER_BYTES) return fail('header-too-large');
    if (input.length < offset + 4) return needMore();
    destination = {
      host: [...input.subarray(offset, offset + 4)].join('.'),
      port: 0,
      addressType: 'ipv4',
    };
    offset += 4;
  } else if (addressType === 3) {
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
      destination = { host, port: 0, addressType: 'domain' };
    } catch {
      return fail('invalid-address');
    }
    offset += length;
  } else if (addressType === 4) {
    if (offset + 16 > MAX_HEADER_BYTES) return fail('header-too-large');
    if (input.length < offset + 16) return needMore();
    destination = {
      host: formatIpv6(input.subarray(offset, offset + 16)),
      port: 0,
      addressType: 'ipv6',
    };
    offset += 16;
  } else {
    return fail('invalid-address-type');
  }

  if (offset + 4 > MAX_HEADER_BYTES) return fail('header-too-large');
  if (input.length < offset + 4) return needMore();
  const port = (input[offset]! << 8) | input[offset + 1]!;
  if (port === 0) return fail('invalid-port');
  destination.port = port;
  if (input[offset + 2] !== 13 || input[offset + 3] !== 10) return fail('malformed');
  offset += 4;
  return { kind: 'ok', value: { presentedCredential, destination, payload: input.slice(offset) } };
}

export function parseTrojanRequest(
  input: Uint8Array,
  expectedHash: string,
): ParseResult<ParsedTrojanRequest> {
  if (!/^[0-9a-f]{56}$/i.test(expectedHash)) return fail('config');
  if (input.length < HASH_LENGTH + 2) return needMore();
  if (!constantTimeEqual(input.subarray(0, HASH_LENGTH), asciiBytes(expectedHash)))
    return fail('auth');
  const candidate = parseTrojanCandidate(input);
  if (candidate.kind !== 'ok') return candidate;
  return {
    kind: 'ok',
    value: {
      destination: candidate.value.destination,
      payload: candidate.value.payload,
    },
  };
}
