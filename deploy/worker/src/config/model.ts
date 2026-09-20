export type KvBinding = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

export type Env = {
  C: KvBinding;
  DB: D1Database;
  ADMIN_PASSWORD: string;
  INSTALL_GENERATION: string;
};

export type ProtocolConfig = {
  schemaVersion: 1;
  createdAt: string;
  vless: { enabled: boolean; uuid: string; path: string };
  trojan: { enabled: boolean; password: string; passwordHash: string; path: string };
  xhttp: { enabled: boolean; path: string; mode: 'stream-one' };
  subscription: { token: string; path: string };
};

export type PublicProtocolStatus = {
  schemaVersion: 1;
  vless: { enabled: boolean; path: string };
  trojan: { enabled: boolean; path: string };
  xhttp: { enabled: boolean; path: string; mode: 'stream-one' };
};
