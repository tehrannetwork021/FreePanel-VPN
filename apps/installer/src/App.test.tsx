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
      workerUrl: 'https://client.example.workers.dev',
      workerName: 'tehran-network-edge',
      version: '0.3.0',
      schemaVersion: 1,
      adminUrl: 'https://client.example.workers.dev/admin',
    }),
    ...overrides,
  } as InstallerApi;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('one-token Cloudflare installer', () => {
  it('starts with only key creation and token paste for normal users', () => {
    render(<App api={api()} />);
    expect(screen.getByRole('link', { name: 'ساخت کلید Cloudflare' })).toBeVisible();
    expect(screen.getByLabelText('Cloudflare API Token')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'نصب با کلید' })).toBeVisible();
    expect(screen.queryByLabelText('حساب Cloudflare')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('نام Worker')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('رمز مدیریت')).not.toBeInTheDocument();
    expect(screen.queryByText(/Developer \/ Advanced install/i)).not.toBeInTheDocument();

    const permissions = JSON.parse(
      new URL(CLOUDFLARE_TOKEN_TEMPLATE_URL).searchParams.get('permissionGroupKeys') ?? '[]',
    );
    expect(permissions).toContainEqual({ key: 'd1', type: 'edit' });
  });

  it('verifies and installs automatically using the first accessible account', async () => {
    const verifyToken = vi.fn().mockResolvedValue({
      ok: true,
      accounts: [
        { id: 'a1', name: 'First' },
        { id: 'a2', name: 'Second' },
      ],
    });
    const installPanel = vi.fn().mockResolvedValue({
      ok: true,
      workerUrl: 'https://client.example.workers.dev',
      workerName: 'tehran-network-edge',
      version: '0.3.0',
      schemaVersion: 1,
      adminUrl: 'https://client.example.workers.dev/admin',
    });
    render(<App api={api({ verifyToken, installPanel })} />);

    fireEvent.change(screen.getByLabelText('Cloudflare API Token'), {
      target: { value: 'cf-token-value-12345678901234567890' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'نصب با کلید' }));

    await waitFor(() => expect(verifyToken).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(installPanel).toHaveBeenCalledTimes(1));
    expect(installPanel).toHaveBeenCalledWith({
      token: 'cf-token-value-12345678901234567890',
      accountId: 'a1',
      workerName: 'tehran-network-edge',
      adminPassword: expect.stringMatching(/^[A-Za-z0-9]{18}$/),
    });
    expect(await screen.findByText('https://client.example.workers.dev/admin')).toBeVisible();
    expect(screen.getByRole('button', { name: 'رمز مدیریت شما' })).toBeVisible();
  });

  it('never persists the token and clears the input after a failed install', async () => {
    const installPanel = vi.fn().mockRejectedValue(new Error('network'));
    const storageSet = vi.spyOn(Storage.prototype, 'setItem');
    const pushState = vi.spyOn(history, 'pushState');
    const replaceState = vi.spyOn(history, 'replaceState');
    render(<App api={api({ installPanel })} />);

    fireEvent.change(screen.getByLabelText('Cloudflare API Token'), {
      target: { value: 'cf-token-value-12345678901234567890' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'نصب با کلید' }));

    await waitFor(() => expect(installPanel).toHaveBeenCalledTimes(1));
    expect(storageSet).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    expect(await screen.findByLabelText('Cloudflare API Token')).toHaveValue('');
  });

  it('shows a safe error when the token has no accessible account', async () => {
    render(
      <App
        api={api({ verifyToken: vi.fn().mockResolvedValue({ ok: true, accounts: [] }) })}
      />,
    );
    fireEvent.change(screen.getByLabelText('Cloudflare API Token'), {
      target: { value: 'cf-token-value-12345678901234567890' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'نصب با کلید' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('هیچ حساب Cloudflare');
  });

  it('switches Persian RTL to English LTR with the same single-token flow', () => {
    render(<App api={api()} />);
    expect(document.querySelector('main')).toHaveAttribute('dir', 'rtl');
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(document.querySelector('main')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('link', { name: 'Generate Cloudflare Key' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Install with key' })).toBeVisible();
  });
});
