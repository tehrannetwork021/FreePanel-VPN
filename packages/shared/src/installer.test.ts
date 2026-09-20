import { describe, expect, expectTypeOf, it } from 'vitest';
import { validateAdminPassword, validateWorkerName } from './installer';
import type {
  InstallErrorCode,
  InstallResult,
  TokenInstallRequest,
  TokenVerifyRequest,
  TokenVerifyResult,
} from './installer';

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

describe('token installer contracts', () => {
  it('includes token-stage errors without changing the install result shape', () => {
    expectTypeOf<'token-invalid'>().toMatchTypeOf<InstallErrorCode>();
    expectTypeOf<'insufficient-scope'>().toMatchTypeOf<InstallErrorCode>();
    expectTypeOf<TokenVerifyRequest>().toEqualTypeOf<{ token: string }>();
    expectTypeOf<TokenVerifyResult>().toEqualTypeOf<{
      ok: true;
      accounts: Array<{ id: string; name: string }>;
    }>();
    expectTypeOf<TokenInstallRequest>().toMatchTypeOf<{
      token: string;
      accountId: string;
      workerName: string;
      adminPassword: string;
    }>();
    expectTypeOf<InstallResult>().toEqualTypeOf<{
      ok: true;
      workerUrl: string;
      workerName: string;
      version: string;
    }>();
  });
});
