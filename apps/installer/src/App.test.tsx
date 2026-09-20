// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App, CLOUDFLARE_TOKEN_TEMPLATE_URL } from './App';
import type { InstallerApi } from './installClient';

function api(overrides: Partial<InstallerApi> = {}): InstallerApi {
  return {
    verifyToken: vi.fn().mockResolvedValue({
      ok: true,
      accounts: [{ id: 'a1', name: 'Primary account' }],
    }),
    installPanel: vi.fn().mockResolvedValue({
      ok: true,
      workerUrl: 'https://pvnetwork-client.example.workers.dev',
      workerName: 'pvnetwork-client',
      version: '0.1.0',
      schemaVersion: 1,
      adminUrl: 'https://pvnetwork-client.example.workers.dev/admin',
    }),
    ...overrides,
  } as InstallerApi;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('free Cloudflare key installer', () => {
  it('starts with Generate Key and token paste, without OAuth/domain/GitHub requirements', () => {
    render(<App api={api()} />);
    expect(screen.getByRole('link', { name: 'ساخت کلید Cloudflare' })).toBeVisible();
    expect(screen.getByLabelText('Cloudflare API Token')).toHaveAttribute('type', 'password');
    const permissions = JSON.parse(
      new URL(CLOUDFLARE_TOKEN_TEMPLATE_URL).searchParams.get('permissionGroupKeys') ?? '[]',
    );
    expect(permissions).toContainEqual({ key: 'd1', type: 'edit' });
    expect(
      screen.queryByText(/OAuth|consent|Client ID|GitHub connection/i),
    ).not.toBeInTheDocument();
  });
  it('verifies token, selects account, installs, and shows the workers.dev result', async () => {
    const verifyToken = vi.fn().mockResolvedValue({
      ok: true,
      accounts: [
        { id: 'a1', name: 'First' },
        { id: 'a2', name: 'Second' },
      ],
    });
    const installPanel = vi.fn().mockResolvedValue({
      ok: true,
      workerUrl: 'https://pvnetwork-client.example.workers.dev',
      workerName: 'pvnetwork-client',
      version: '0.1.0',
      schemaVersion: 1,
      adminUrl: 'https://pvnetwork-client.example.workers.dev/admin',
    });
    render(<App api={api({ verifyToken, installPanel })} />);

    const tokenInput = screen.getByLabelText('Cloudflare API Token');
    fireEvent.change(tokenInput, { target: { value: 'cf-token-value-12345678901234567890' } });
    fireEvent.click(screen.getByRole('button', { name: 'بررسی کلید' }));
    await waitFor(() =>
      expect(verifyToken).toHaveBeenCalledWith('cf-token-value-12345678901234567890'),
    );
    expect(tokenInput).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('حساب Cloudflare'), { target: { value: 'a2' } });
    fireEvent.change(screen.getByLabelText('نام Worker'), {
      target: { value: 'pvnetwork-client' },
    });
    fireEvent.change(screen.getByLabelText('رمز مدیریت'), {
      target: { value: 'correct-horse-1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'نصب پنل' }));

    await waitFor(() =>
      expect(installPanel).toHaveBeenCalledWith({
        token: 'cf-token-value-12345678901234567890',
        accountId: 'a2',
        workerName: 'pvnetwork-client',
        adminPassword: 'correct-horse-1234',
      }),
    );
    expect(await screen.findByText('https://pvnetwork-client.example.workers.dev')).toBeVisible();
    expect(screen.getByRole('link', { name: 'باز کردن پنل مدیریت' })).toHaveAttribute(
      'href',
      'https://pvnetwork-client.example.workers.dev/admin',
    );
    expect(screen.getByRole('link', { name: 'باز کردن Worker' })).toHaveAttribute(
      'href',
      'https://pvnetwork-client.example.workers.dev',
    );
  });
  it('keeps the token only in volatile memory and clears it after install attempt', async () => {
    const verifyToken = vi
      .fn()
      .mockResolvedValue({ ok: true, accounts: [{ id: 'a1', name: 'One' }] });
    const installPanel = vi.fn().mockRejectedValue(new Error('network'));
    const storageSet = vi.spyOn(Storage.prototype, 'setItem');
    const pushState = vi.spyOn(history, 'pushState');
    const replaceState = vi.spyOn(history, 'replaceState');
    render(<App api={api({ verifyToken, installPanel })} />);

    fireEvent.change(screen.getByLabelText('Cloudflare API Token'), {
      target: { value: 'cf-token-value-12345678901234567890' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'بررسی کلید' }));
    await screen.findByLabelText('حساب Cloudflare');
    expect(storageSet).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('رمز مدیریت'), {
      target: { value: 'correct-horse-1234' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'نصب پنل' }));
    await waitFor(() => expect(installPanel).toHaveBeenCalledTimes(1));
    expect(await screen.findByLabelText('Cloudflare API Token')).toHaveValue('');
  });

  it('allows a short non-empty admin password after token verification', async () => {
    render(<App api={api()} />);
    fireEvent.change(screen.getByLabelText('Cloudflare API Token'), {
      target: { value: 'cf-token-value-12345678901234567890' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'بررسی کلید' }));
    const password = await screen.findByLabelText('رمز مدیریت');
    expect(password).toHaveAttribute('minlength', '1');
    fireEvent.change(password, { target: { value: '12345' } });
    expect(password).toHaveValue('12345');
  });

  it('switches Persian RTL to English LTR with the same key flow', () => {
    render(<App api={api()} />);
    expect(document.querySelector('main')).toHaveAttribute('dir', 'rtl');
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(document.querySelector('main')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('link', { name: 'Generate Cloudflare Key' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Verify key' })).toBeVisible();
  });
});
