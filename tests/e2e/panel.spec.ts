import { expect, test, type Page, type Route } from '@playwright/test';

type MockUser = {
  id: string;
  name: string;
  enabled: boolean;
  quotaBytes: number | null;
  dailyQuotaBytes: number | null;
  expiresAt: number | null;
  totalUsedBytes: number;
  allowVless: boolean;
  allowTrojan: boolean;
  allowXhttp: boolean;
  notes: string;
  lastSubscriptionAt: number | null;
  lastTunnelAt: number | null;
  version: number;
  createdAt: number;
  updatedAt: number;
};

type MockState = {
  authenticated: boolean;
  users: MockUser[];
  subscriptionVersion: number;
  vlessVersion: number;
  trojanVersion: number;
  loginCount: number;
};

const now = Date.parse('2026-09-20T12:00:00Z');
const ok = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

function defaultState(authenticated = false): MockState {
  return {
    authenticated,
    users: [],
    subscriptionVersion: 1,
    vlessVersion: 1,
    trojanVersion: 1,
    loginCount: 0,
  };
}

function accessBody(state: MockState, id: string) {
  return {
    subscriptionUrl: `https://edge.example/sub/sub-${id}-v${state.subscriptionVersion}`,
    subscriptionToken: `sub-${id}-v${state.subscriptionVersion}`,
    qr: {
      kind: 'subscription-url',
      payload: `https://edge.example/sub/sub-${id}-v${state.subscriptionVersion}`,
    },
    vless: {
      uuid: `11111111-2222-4333-8444-${String(state.vlessVersion).padStart(12, '0')}`,
      version: state.vlessVersion,
    },
    trojan: { password: `trojan-${id}-v${state.trojanVersion}`, version: state.trojanVersion },
    subscriptionVersion: state.subscriptionVersion,
  };
}

function userFromInput(input: Record<string, unknown>): MockUser {
  return {
    id: '00000000-1111-4222-8333-444444444444',
    name: String(input.name ?? 'e2e-user'),
    enabled: input.enabled !== false,
    quotaBytes: (input.quotaBytes as number | null) ?? null,
    dailyQuotaBytes: (input.dailyQuotaBytes as number | null) ?? null,
    expiresAt: (input.expiresAt as number | null) ?? null,
    totalUsedBytes: 4096,
    allowVless: input.allowVless !== false,
    allowTrojan: input.allowTrojan !== false,
    allowXhttp: input.allowXhttp !== false,
    notes: String(input.notes ?? ''),
    lastSubscriptionAt: now,
    lastTunnelAt: now,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

async function mockPanelApi(page: Page, state = defaultState()) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    const method = request.method();
    const body =
      method === 'GET' ? {} : (JSON.parse(request.postData() || '{}') as Record<string, unknown>);

    if (path === '/api/auth/session') {
      return ok(
        route,
        state.authenticated
          ? { authenticated: true, expiresAt: now + 3_600_000 }
          : { authenticated: false },
      );
    }
    if (path === '/api/auth/login' && method === 'POST') {
      if (body.password !== 'admin-pass')
        return ok(route, { ok: false, error: 'invalid-credentials' }, 401);
      state.authenticated = true;
      state.loginCount += 1;
      return ok(route, { ok: true, expiresAt: now + 3_600_000 });
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      state.authenticated = false;
      return ok(route, { ok: true });
    }
    if (path === '/api/auth/password' && method === 'POST') {
      state.authenticated = false;
      return ok(route, { ok: true });
    }
    if (!state.authenticated) return ok(route, { ok: false, error: 'unauthorized' }, 401);

    if (path === '/api/overview') {
      return ok(route, {
        ok: true,
        enabledUsers: state.users.filter((user) => user.enabled).length,
        recentUsers: state.users.length,
        todayBytes: 1234,
        totalBytes: 5678,
        expiryWarnings: 1,
      });
    }
    if (path === '/api/users' && method === 'GET')
      return ok(route, { ok: true, users: state.users });
    if (path === '/api/users' && method === 'POST') {
      const user = userFromInput(body);
      state.users.unshift(user);
      return ok(route, { ok: true, user }, 201);
    }
    const userMatch = path.match(/^\/api\/users\/([0-9a-f-]+)$/u);
    if (userMatch && method === 'PATCH') {
      const user = state.users.find((item) => item.id === userMatch[1]);
      if (!user) return ok(route, { ok: false, error: 'not-found' }, 404);
      Object.assign(user, body, { version: user.version + 1, updatedAt: now + user.version });
      return ok(route, { ok: true, user });
    }
    if (userMatch && method === 'DELETE') {
      state.users = state.users.filter((item) => item.id !== userMatch[1]);
      return ok(route, { ok: true });
    }
    if (userMatch && method === 'GET') {
      const user = state.users.find((item) => item.id === userMatch[1]);
      return user
        ? ok(route, { ok: true, user })
        : ok(route, { ok: false, error: 'not-found' }, 404);
    }

    const accessMatch = path.match(/^\/api\/users\/([0-9a-f-]+)\/access$/u);
    if (accessMatch && method === 'GET')
      return ok(route, { ok: true, access: accessBody(state, accessMatch[1]) });
    const subRotate = path.match(/^\/api\/users\/([0-9a-f-]+)\/rotate-subscription$/u);
    if (subRotate && method === 'POST') {
      state.subscriptionVersion += 1;
      return ok(route, { ok: true });
    }
    const credentialRotate = path.match(/^\/api\/users\/([0-9a-f-]+)\/rotate-credentials$/u);
    if (credentialRotate && method === 'POST') {
      const protocol = String(body.protocol ?? 'all');
      if (protocol === 'vless' || protocol === 'all') state.vlessVersion += 1;
      if (protocol === 'trojan' || protocol === 'all') state.trojanVersion += 1;
      return ok(route, { ok: true });
    }
    if (/^\/api\/users\/[0-9a-f-]+\/usage$/u.test(path)) {
      return ok(route, {
        ok: true,
        usage: [
          {
            dayUtc: '2026-09-20',
            uploadBytes: 1024,
            downloadBytes: 3072,
            totalBytes: 4096,
            connections: 3,
          },
        ],
      });
    }
    if (path === '/api/usage') {
      return ok(route, {
        ok: true,
        usage: [
          {
            dayUtc: '2026-09-20',
            uploadBytes: 2048,
            downloadBytes: 4096,
            totalBytes: 6144,
            connections: 4,
          },
        ],
      });
    }

    if (path === '/api/audit') {
      return ok(route, {
        ok: true,
        entries: [
          {
            id: 1,
            ts: now,
            actor: 'admin',
            action: 'user.update',
            targetId: state.users[0]?.id ?? null,
          },
        ],
      });
    }
    if (path === '/api/security/logins') {
      return ok(route, {
        ok: true,
        events: [{ id: 1, ts: now, success: true, country: 'DE', colo: 'FRA' }],
      });
    }
    return ok(route, { ok: false, error: 'not-found' }, 404);
  });
  return state;
}

async function loginFromFa(page: Page) {
  await expect(page.getByRole('heading', { name: 'ورود مدیر' })).toBeVisible();
  await page.getByLabel('رمز مدیریت').fill('admin-pass');
  await page.getByRole('button', { name: 'ورود' }).click();
  await expect(page.getByText('نمای وضعیت')).toBeVisible();
}

test('admin lifecycle covers login, users, access, usage and security', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'full lifecycle runs once on desktop');
  const state = await mockPanelApi(page);
  await page.goto('/');
  await loginFromFa(page);
  await expect(page.locator('[data-testid="dashboard"]')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('Control overview')).toBeVisible();
  await expect(page.locator('[data-testid="dashboard"]')).toHaveAttribute('dir', 'ltr');

  await page.getByRole('button', { name: 'Users' }).click();
  await page.getByRole('button', { name: 'New user' }).click();
  await page.getByLabel('User name').fill('browser-user');
  await page.getByLabel('Total quota (bytes)').fill('100000');
  await page.getByLabel('Daily quota (bytes)').fill('50000');
  await page.getByLabel('Expiry').fill('2026-10-20T12:00');
  await page.getByLabel('Notes').fill('browser-e2e');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('browser-user')).toBeVisible();
  expect(state.users).toHaveLength(1);
  expect(state.users[0]?.quotaBytes).toBe(100000);
  expect(state.users[0]?.dailyQuotaBytes).toBe(50000);

  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('User name').fill('browser-user-edited');
  await page.getByLabel('Total quota (bytes)').fill('120000');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('browser-user-edited')).toBeVisible();
  expect(state.users[0]?.version).toBe(2);
  expect(state.users[0]?.quotaBytes).toBe(120000);

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText('Paused')).toBeVisible();
  expect(state.users[0]?.enabled).toBe(false);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('Enabled')).toBeVisible();
  expect(state.users[0]?.enabled).toBe(true);

  await page.getByRole('button', { name: 'Access' }).click();
  const accessDialog = page.getByRole('dialog', { name: 'Private access' });
  await expect(accessDialog.locator('.qr-box svg')).toBeVisible();
  await expect(accessDialog.locator('.secret-row').first().getByText(/-v1/)).toBeVisible();
  await accessDialog.getByRole('button', { name: 'Rotate subscription' }).click();
  await expect(accessDialog.locator('.secret-row').first().getByText(/-v2/)).toBeVisible();
  expect(state.subscriptionVersion).toBe(2);
  await accessDialog.getByRole('button', { name: 'Rotate both credentials' }).click();
  expect(state.vlessVersion).toBe(2);
  expect(state.trojanVersion).toBe(2);
  await accessDialog.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Usage' }).click();
  await expect(page.getByRole('heading', { name: 'Usage' })).toBeVisible();
  await expect(page.getByText('2026-09-20')).toBeVisible();
  await expect(page.getByRole('cell', { name: '4', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Logs & Security' }).click();
  await expect(page.getByText('user.update')).toBeVisible();
  await expect(page.getByText(/DE \/ FRA/)).toBeVisible();
  await page.getByLabel('Current password').fill('admin-pass');
  await page.getByLabel('New password').fill('updated-pass');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();

  await page.getByLabel('Admin password').fill('admin-pass');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Logs & Security' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
  expect(state.authenticated).toBe(false);
  expect(state.loginCount).toBe(2);
});

test('authenticated overview stays bilingual without horizontal overflow', async ({
  page,
}, testInfo) => {
  await mockPanelApi(page, defaultState(true));
  await page.goto('/');
  await expect(page.getByText('نمای وضعیت')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  if (testInfo.project.name === 'desktop') {
    await page.screenshot({ path: 'assets/readme/dashboard-fa.png', fullPage: true });
  }
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('Control overview')).toBeVisible();
  if (testInfo.project.name === 'desktop') {
    await page.screenshot({ path: 'assets/readme/dashboard-en.png', fullPage: true });
  }
});

test('390px mobile keeps all Phase A destinations reachable', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile layout contract');
  await mockPanelApi(page, defaultState(true));
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('button')).toHaveCount(4);
  await expect(nav.getByRole('button', { name: 'کاربران' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'مصرف' })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'گزارش‌ها و امنیت' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
