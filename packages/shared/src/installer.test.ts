import { describe, expect, expectTypeOf, it } from 'vitest';
import { validateAdminPassword, validateWorkerName } from './installer';
import type {
  InstallErrorCode,
  InstallResult,
  TokenInstallRequest,
  TokenInstallResult,
  TokenVerifyRequest,
  TokenVerifyResult,
} from './installer';

describe('installer validation', () => {
  it('accepts a safe Worker name and rejects unsafe names', () => {
    expect(validateWorkerName('pvnetwork-client')).toEqual({ ok: true, value: 'pvnetwork-client' });
    expect(validateWorkerName('../bad')).toMatchObject({ ok: false });
    expect(validateWorkerName('UPPER CASE')).toMatchObject({ ok: false });
  });

  it('accepts any non-empty admin password and rejects only empty input', () => {
    expect(validateAdminPassword('')).toMatchObject({ ok: false });
    expect(validateAdminPassword('1')).toEqual({ ok: true });
    expect(validateAdminPassword('12345')).toEqual({ ok: true });
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
    expectTypeOf<TokenInstallRequest>().toEqualTypeOf<{ token: string }>();
    expectTypeOf<InstallResult>().toEqualTypeOf<{
      ok: true;
      workerUrl: string;
      workerName: string;
      version: string;
      schemaVersion: number;
      adminUrl: string;
    }>();
    expectTypeOf<TokenInstallResult>().toEqualTypeOf<InstallResult & { adminPassword: string }>();
  });
});
