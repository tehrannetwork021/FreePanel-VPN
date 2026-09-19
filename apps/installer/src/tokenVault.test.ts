// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createVolatileTokenVault } from './tokenVault';

describe('volatile Cloudflare token vault', () => {
  it('keeps token only in memory and clears it', () => {
    const token = 'cfut_example_secret_that_must_not_persist';
    const vault = createVolatileTokenVault();
    vault.set(token);
    expect(vault.read()).toBe(token);
    expect(window.localStorage.getItem('cloudflare-token')).toBeNull();
    expect(window.sessionStorage.getItem('cloudflare-token')).toBeNull();
    vault.clear();
    expect(vault.read()).toBeUndefined();
  });
});
