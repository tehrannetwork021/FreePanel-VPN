import { bytesToUuid } from '../core/uuid';
import { getUser, isUserAllowed } from '../db/users';
import { credentialLookupHash, type CredentialProtocol } from './derivedSecrets';

export type TunnelChannel = 'vless-ws' | 'trojan-ws' | 'vless-xhttp';
export type TunnelPrincipal =
  | { kind: 'user'; userId: string; channel: TunnelChannel }
  | { kind: 'legacy'; channel: TunnelChannel };
export type TunnelAuthResult =
  | { kind: 'authorized'; principal: TunnelPrincipal }
  | { kind: 'not-found' }
  | { kind: 'denied-user' };

type CredentialRow = {
  user_id: string;
  protocol: CredentialProtocol;
  secret_version: number;
  lookup_hash: string;
  enabled: number;
};

function protocolFor(channel: TunnelChannel): CredentialProtocol {
  return channel === 'trojan-ws' ? 'trojan' : 'vless';
}

function presentedString(protocol: CredentialProtocol, bytes: Uint8Array): string | null {
  if (protocol === 'vless') {
    try {
      return bytesToUuid(bytes);
    } catch {
      return null;
    }
  }
  if (bytes.byteLength !== 56) return null;
  const text = new TextDecoder().decode(bytes).toLowerCase();
  return /^[0-9a-f]{56}$/u.test(text) ? text : null;
}

function channelAllowed(
  channel: TunnelChannel,
  user: Awaited<ReturnType<typeof getUser>>,
): boolean {
  if (!user) return false;
  if (channel === 'vless-ws') return user.allowVless;
  if (channel === 'trojan-ws') return user.allowTrojan;
  return user.allowVless && user.allowXhttp;
}

export async function resolveTunnelPrincipal(
  db: D1Database,
  channel: TunnelChannel,
  presentedCredential: Uint8Array,
  now: number,
): Promise<TunnelAuthResult> {
  const protocol = protocolFor(channel);
  const presented = presentedString(protocol, presentedCredential);
  if (!presented) return { kind: 'not-found' };
  const lookup = await credentialLookupHash(protocol, presented);
  const row = await db
    .prepare(
      'SELECT user_id, protocol, secret_version, lookup_hash, enabled FROM user_credentials WHERE protocol = ? AND lookup_hash = ?',
    )
    .bind(protocol, lookup)
    .first<CredentialRow>();
  if (!row) return { kind: 'not-found' };
  if (row.enabled !== 1) return { kind: 'denied-user' };

  const user = await getUser(db, row.user_id);
  if (!user) return { kind: 'denied-user' };
  if (!channelAllowed(channel, user)) return { kind: 'denied-user' };
  if (!(await isUserAllowed(db, user, now))) return { kind: 'denied-user' };
  return { kind: 'authorized', principal: { kind: 'user', userId: user.id, channel } };
}
