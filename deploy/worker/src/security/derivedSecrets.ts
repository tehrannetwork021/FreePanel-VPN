import { sha224Hex } from '../core/sha224';

export type CredentialProtocol = 'vless' | 'trojan';

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function decodeSeed(value: string): Uint8Array {
  try {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    if (bytes.byteLength !== 32) throw new Error('invalid');
    return bytes;
  } catch {
    throw new Error('invalid-installation-seed');
  }
}

async function deriveBytes(
  seed: string,
  purpose: string,
  userId: string,
  version: number,
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('invalid-secret-version');
  const key = await crypto.subtle.importKey(
    'raw',
    decodeSeed(seed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const message = new TextEncoder().encode(`tn:v1:${purpose}:${userId}:${version}`);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function deriveSubscriptionToken(seed: string, userId: string, version: number) {
  return base64url((await deriveBytes(seed, 'subscription', userId, version)).slice(0, 24));
}

export async function deriveTrojanPassword(seed: string, userId: string, version: number) {
  return base64url((await deriveBytes(seed, 'trojan', userId, version)).slice(0, 24));
}

export async function deriveVlessUuid(seed: string, userId: string, version: number) {
  const bytes = (await deriveBytes(seed, 'vless', userId, version)).slice(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function normalizePresentedCredential(protocol: CredentialProtocol, value: string): string {
  if (protocol === 'vless') return value.trim().toLowerCase();
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{56}$/u.test(normalized) ? normalized : sha224Hex(value);
}

export async function subscriptionLookupHash(token: string): Promise<string> {
  return sha256Hex(token);
}

export async function credentialLookupHash(
  protocol: CredentialProtocol,
  presented: string,
): Promise<string> {
  return sha256Hex(`${protocol}:${normalizePresentedCredential(protocol, presented)}`);
}
