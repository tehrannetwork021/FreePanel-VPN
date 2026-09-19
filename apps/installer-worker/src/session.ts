const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type OAuthState = { state: string; issuedAt: number; expiresAt: number };
export type InstallSession = { accessToken: string; issuedAt: number; expiresAt: number };

export const OAUTH_STATE_COOKIE = '__Host-tn_oauth_state';
export const INSTALL_SESSION_COOKIE = '__Host-tn_install_session';

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const standard = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
  return fromBase64(padded);
}

async function importCookieKey(keyB64: string): Promise<CryptoKey> {
  const raw = fromBase64(keyB64);
  if (raw.byteLength !== 32) throw new Error('invalid-session-key');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function sealCookie<T extends { expiresAt: number }>(
  payload: T,
  keyB64: string,
): Promise<string> {
  const key = await importCookieKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(payload)),
  );
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function openCookie<T extends { expiresAt: number }>(
  value: string,
  keyB64: string,
  now = Date.now(),
): Promise<T> {
  try {
    const [version, ivPart, cipherPart, extra] = value.split('.');
    if (version !== 'v1' || !ivPart || !cipherPart || extra) throw new Error('invalid');
    const key = await importCookieKey(keyB64);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(ivPart) },
      key,
      fromBase64Url(cipherPart),
    );
    const payload = JSON.parse(decoder.decode(plaintext)) as T;
    if (!payload || typeof payload.expiresAt !== 'number') throw new Error('invalid');
    if (payload.expiresAt <= now) throw new Error('expired-session');
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message === 'expired-session') throw error;
    throw new Error('invalid-session');
  }
}

function serializeCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

export async function makeOAuthStateCookie(payload: OAuthState, keyB64: string): Promise<string> {
  return serializeCookie(OAUTH_STATE_COOKIE, await sealCookie(payload, keyB64), 600);
}

export async function readOAuthStateCookie(
  request: Request,
  keyB64: string,
  now = Date.now(),
): Promise<OAuthState> {
  const value = readCookie(request, OAUTH_STATE_COOKIE);
  if (!value) throw new Error('invalid-session');
  return openCookie<OAuthState>(value, keyB64, now);
}

export async function makeInstallSessionCookie(
  payload: InstallSession,
  keyB64: string,
): Promise<string> {
  return serializeCookie(INSTALL_SESSION_COOKIE, await sealCookie(payload, keyB64), 600);
}

export async function readInstallSessionCookie(
  request: Request,
  keyB64: string,
  now = Date.now(),
): Promise<InstallSession> {
  const value = readCookie(request, INSTALL_SESSION_COOKIE);
  if (!value) throw new Error('invalid-session');
  return openCookie<InstallSession>(value, keyB64, now);
}

export function clearOAuthStateCookie(): string {
  return serializeCookie(OAUTH_STATE_COOKIE, '', 0);
}

export function clearInstallSessionCookie(): string {
  return serializeCookie(INSTALL_SESSION_COOKIE, '', 0);
}

export function clearInstallerCookies(): string[] {
  return [clearOAuthStateCookie(), clearInstallSessionCookie()];
}
