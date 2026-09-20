/**
 * Local copies of the two runtime validators (vendored from packages/shared)
 * so the installer Worker stays fully self-contained for the Deploy to
 * Cloudflare button: no workspace dependency has to be installed for the
 * bundle to build.
 */

export function validateWorkerName(input: string) {
  const value = input.trim();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)
    ? ({ ok: true, value } as const)
    : ({ ok: false, error: 'invalid-worker-name' as const } as const);
}

export function validateAdminPassword(password: string) {
  return password.length > 0
    ? ({ ok: true } as const)
    : ({ ok: false, error: 'invalid-admin-password' as const } as const);
}
