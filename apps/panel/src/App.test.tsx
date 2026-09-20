// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { PanelApi, UserRecord } from './api/client';

afterEach(cleanup);

function fakeApi() {
  let users: UserRecord[] = [];
  const mutations: string[] = [];
  const api: PanelApi = {
    session: vi.fn(async () => ({ authenticated: true, expiresAt: Date.now() + 60_000 })),
    login: vi.fn(async () => ({ ok: true as const, expiresAt: Date.now() + 60_000 })),
    logout: vi.fn(async () => ({ ok: true as const })),
    changePassword: vi.fn(async () => ({ ok: true as const })),
    overview: vi.fn(async () => ({
      enabledUsers: 3,
      recentUsers: 2,
      todayBytes: 1234,
      totalBytes: 5678,
      expiryWarnings: 1,
    })),
    listUsers: vi.fn(async () => users),
    createUser: vi.fn(async (input) => {
      mutations.push('create');
      const user: UserRecord = {
        id: crypto.randomUUID(),
        name: input.name,
        enabled: true,
        quotaBytes: null,
        dailyQuotaBytes: null,
        expiresAt: null,
        totalUsedBytes: 0,
        allowVless: true,
        allowTrojan: true,
        allowXhttp: true,
        notes: '',
        lastSubscriptionAt: null,
        lastTunnelAt: null,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      users = [...users, user];
      return user;
    }),
    updateUser: vi.fn(async (id, input) => {
      mutations.push(input.enabled === false ? 'pause' : 'update');
      users = users.map((user) =>
        user.id === id
          ? { ...user, ...input, version: user.version + 1, updatedAt: Date.now() }
          : user,
      );
      return users.find((user) => user.id === id)!;
    }),
    deleteUser: vi.fn(async (id) => {
      users = users.filter((user) => user.id !== id);
      mutations.push('delete');
    }),
    userAccess: vi.fn(async (id) => ({
      subscriptionUrl: `https://worker.example/sub/token-${id}`,
      subscriptionToken: `token-${id}`,
      qr: { kind: 'subscription-url' as const, payload: `https://worker.example/sub/token-${id}` },
      vless: { uuid: '11111111-2222-4333-8444-555555555555', version: 1 },
      trojan: { password: 'trojan-test', version: 1 },
      subscriptionVersion: 1,
    })),
    rotateSubscription: vi.fn(async () => {
      mutations.push('rotate-subscription');
    }),
    rotateCredentials: vi.fn(async () => {
      mutations.push('rotate-credentials');
    }),
    aggregateUsage: vi.fn(async () => []),
    userUsage: vi.fn(async () => []),
    audit: vi.fn(async () => []),
    loginEvents: vi.fn(async () => []),
  };
  return { api, mutations };
}

describe('real control-plane dashboard', () => {
  it('shows real overview values, starts RTL, switches LTR, and has no fake latency preview', async () => {
    const { api } = fakeApi();
    render(<App api={api} />);
    expect(await screen.findByTestId('dashboard')).toHaveAttribute('dir', 'rtl');
    expect(await screen.findByText('3')).toBeVisible();
    expect(screen.getByText('1.21 KB')).toBeVisible();
    expect(screen.queryByText('28 ms')).not.toBeInTheDocument();
    expect(screen.queryByText('FRA')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByTestId('dashboard')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('Overview')).toBeVisible();
  });
  it('creates, pauses and rotates a user through the real users workflow', async () => {
    const { api, mutations } = fakeApi();
    render(<App api={api} />);
    await screen.findByTestId('dashboard');
    fireEvent.click(screen.getByRole('button', { name: /کاربران|users/i }));
    fireEvent.click(await screen.findByRole('button', { name: /کاربر جدید|new user/i }));
    fireEvent.change(screen.getByLabelText(/نام کاربر|user name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ذخیره|save/i }));
    expect(await screen.findByText('Test User')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /توقف|pause/i }));
    await waitFor(() => expect(mutations).toContain('pause'));
    fireEvent.click(screen.getByRole('button', { name: /تعویض لینک|rotate subscription/i }));
    await waitFor(() => expect(mutations).toContain('rotate-subscription'));
  });

  it('shows a login gate when there is no active session', async () => {
    const { api } = fakeApi();
    api.session = vi.fn(async () => ({ authenticated: false }));
    render(<App api={api} />);
    expect(await screen.findByLabelText(/رمز مدیریت|admin password/i)).toBeVisible();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });
});
