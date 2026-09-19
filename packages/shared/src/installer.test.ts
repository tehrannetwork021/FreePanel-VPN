import { describe, expect, it } from 'vitest';
import { validateAdminPassword, validateWorkerName } from './installer';

describe('installer validation', () => {
  it('accepts a safe Worker name and rejects unsafe names', () => {
    expect(validateWorkerName('pvnetwork-client')).toEqual({ ok: true, value: 'pvnetwork-client' });
    expect(validateWorkerName('../bad')).toMatchObject({ ok: false });
    expect(validateWorkerName('UPPER CASE')).toMatchObject({ ok: false });
  });

  it('requires an admin password of at least 16 characters', () => {
    expect(validateAdminPassword('123456789012345')).toMatchObject({ ok: false });
    expect(validateAdminPassword('correct-horse-1234')).toEqual({ ok: true });
  });
});
