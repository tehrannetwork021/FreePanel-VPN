import { constantTimeEqual } from '../core/bytes';

const PLACEHOLDER = 'CHANGE-ME-TO-A-LONG-RANDOM-PASSWORD';

export function validateAdminSecret(secret: string): void {
  if (!secret || secret === PLACEHOLDER) throw new Error('unsafe-admin-secret');
}

async function digest(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export async function verifyAdminPassword(candidate: string, configured: string): Promise<boolean> {
  try {
    validateAdminSecret(configured);
  } catch {
    return false;
  }
  const [left, right] = await Promise.all([digest(candidate), digest(configured)]);
  return constantTimeEqual(left, right);
}
