import { sha224Hex } from '../core/sha224';
import type { Env, ProtocolConfig, PublicProtocolStatus } from './model';

const CONFIG_KEY = 'protocol:config:v1';

function randomHex(bytes: number): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return [...data].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function isConfig(value: unknown): value is ProtocolConfig {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<ProtocolConfig>;
  return (
    c.schemaVersion === 1 &&
    typeof c.createdAt === 'string' &&
    typeof c.vless?.uuid === 'string' &&
    typeof c.vless?.path === 'string' &&
    typeof c.vless?.enabled === 'boolean' &&
    typeof c.trojan?.password === 'string' &&
    typeof c.trojan?.passwordHash === 'string' &&
    typeof c.trojan?.path === 'string' &&
    typeof c.trojan?.enabled === 'boolean' &&
    c.xhttp?.mode === 'stream-one' &&
    typeof c.xhttp?.path === 'string' &&
    typeof c.xhttp?.enabled === 'boolean' &&
    typeof c.subscription?.token === 'string' &&
    typeof c.subscription?.path === 'string'
  );
}

export async function loadProtocolConfig(env: Env): Promise<ProtocolConfig | null> {
  const raw = await env.C.get(CONFIG_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('invalid-protocol-config');
  }
  if (!isConfig(parsed)) throw new Error('invalid-protocol-config');
  return parsed;
}

export async function ensureProtocolConfig(env: Env): Promise<ProtocolConfig> {
  const existing = await loadProtocolConfig(env);
  if (existing) return existing;
  const password = randomHex(24);
  const created: ProtocolConfig = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    vless: { enabled: true, uuid: crypto.randomUUID(), path: '/vless' },
    trojan: { enabled: true, password, passwordHash: sha224Hex(password), path: '/trojan' },
    xhttp: { enabled: true, path: '/xhttp', mode: 'stream-one' },
    subscription: { token: randomHex(24), path: '/sub' },
  };
  await env.C.put(CONFIG_KEY, JSON.stringify(created));
  return created;
}

export function publicProtocolStatus(config: ProtocolConfig): PublicProtocolStatus {
  return {
    schemaVersion: 1,
    vless: { enabled: config.vless.enabled, path: config.vless.path },
    trojan: { enabled: config.trojan.enabled, path: config.trojan.path },
    xhttp: { enabled: config.xhttp.enabled, path: config.xhttp.path, mode: config.xhttp.mode },
  };
}
