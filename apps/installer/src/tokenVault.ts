export type VolatileTokenVault = {
  set(token: string): void;
  read(): string | undefined;
  clear(): void;
};

export function createVolatileTokenVault(): VolatileTokenVault {
  let token: string | undefined;

  return {
    set(value) {
      token = value;
    },
    read() {
      return token;
    },
    clear() {
      token = undefined;
    },
  };
}
