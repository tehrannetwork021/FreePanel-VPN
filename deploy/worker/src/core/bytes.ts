export function toBytes(input: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof input === 'string') return new TextEncoder().encode(input);
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
