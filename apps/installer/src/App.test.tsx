// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { InstallerClientError, type InstallerApi } from './installClient';

function api(overrides: Partial<InstallerApi> = {}): InstallerApi {
  return {
    getSession: vi.fn().mockResolvedValue({ connected: false }),
    startOAuth: vi.fn(),
    installPanel: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

describe('OAuth-first installer', () => {
  it('shows Cloudflare OAuth as the only primary install action and keeps Advanced collapsed', async () => {
    const client = api();
    render(<App api={client} />);

    const cta = await screen.findByRole('button', { name: 'نصب با Cloudflare' });
    expect(cta).toBeVisible();
    expect(screen.queryByLabelText('Cloudflare API Token')).not.toBeInTheDocument();
    expect(screen.queryByText(/GitHub/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('button', { name: 'Install with Cloudflare' })).toBeVisible();
  });

  it('installs into a selected account and shows the final Worker URL', async () => {
    const installPanel = vi.fn().mockResolvedValue({
      ok: true,
      workerUrl: 'https://pvnetwork-client.example.workers.dev',
      workerName: 'pvnetwork-client',
      version: '0.1.0',
    });
    const client = api({
      getSession: vi.fn().mockResolvedValue({
        connected: true,
        expiresAt: Date.now() + 600_000,
        accounts: [
          { id: 'a1', name: 'First account' },
          { id: 'a2', name: 'Second account' },
        ],
      }),
      installPanel,
    });
    render(<App api={client} />);

    const account = await screen.findByLabelText('حساب Cloudflare');
    fireEvent.change(account, { target: { value: 'a2' } });
    fireEvent.change(screen.getByLabelText('نام Worker'), {
      target: { value: 'pvnetwork-client' },
    });
    const password = screen.getByLabelText('رمز مدیریت');
    fireEvent.change(password, { target: { value: 'correct-horse-1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'نصب پنل' }));

    await waitFor(() =>
      expect(installPanel).toHaveBeenCalledWith({
        accountId: 'a2',
        workerName: 'pvnetwork-client',
        adminPassword: 'correct-horse-1234',
      }),
    );
    expect(await screen.findByText('https://pvnetwork-client.example.workers.dev')).toBeVisible();
    expect(screen.getByRole('link', { name: 'باز کردن پنل' })).toHaveAttribute(
      'href',
      'https://pvnetwork-client.example.workers.dev',
    );
    expect(screen.queryByDisplayValue('correct-horse-1234')).not.toBeInTheDocument();
  });

  it('uses RTL/LTR and offers reauthorization for expired or insufficient authorization', async () => {
    const expiredApi = api({
      getSession: vi.fn().mockRejectedValue(new InstallerClientError('authorization-expired')),
    });
    const { unmount } = render(<App api={expiredApi} />);
    await screen.findByText('مجوز Cloudflare منقضی شده است. دوباره متصل شوید.');
    expect(document.querySelector('main')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'اتصال دوباره به Cloudflare' })).toBeVisible();
    unmount();

    const scopeApi = api({
      getSession: vi.fn().mockRejectedValue(new InstallerClientError('insufficient-scope')),
    });
    render(<App api={scopeApi} />);
    await screen.findByText(/دسترسی لازم Cloudflare/i);
    expect(screen.getByRole('button', { name: 'اعطای مجوز دوباره' })).toBeVisible();
    expect(screen.queryByLabelText('Cloudflare API Token')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(document.querySelector('main')).toHaveAttribute('dir', 'ltr');
  });

  it('reveals the legacy API-token path only inside Advanced installation', async () => {
    render(<App api={api()} tokenInstall={vi.fn().mockResolvedValue(undefined)} />);
    await screen.findByRole('button', { name: 'نصب با Cloudflare' });
    fireEvent.click(screen.getByRole('button', { name: 'نصب پیشرفته' }));
    expect(screen.getByLabelText('Cloudflare API Token')).toHaveAttribute('type', 'password');
    expect(screen.getByText('Developer install')).toBeVisible();
  });
});
