import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Check,
  Cloud,
  Copy,
  KeyRound,
  Languages,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { CloudflareAccountView, InstallResult } from '@tehrannetwork/shared';
import { createTranslator, getDirection, type Locale } from '@tehrannetwork/i18n';
import { createVolatileTokenVault } from './tokenVault';
import { browserInstallerApi, InstallerClientError, type InstallerApi } from './installClient';
import './app.css';

const permissions = [
  { key: 'workers_scripts', type: 'edit' },
  { key: 'workers_kv_storage', type: 'edit' },
  { key: 'd1', type: 'edit' },
  { key: 'account_settings', type: 'read' },
];

export const CLOUDFLARE_TOKEN_TEMPLATE_URL =
  `https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=${encodeURIComponent(JSON.stringify(permissions))}` +
  '&accountId=%2A&zoneId=all&name=Tehran%20Network%20Installer';
export const CLOUDFLARE_TOKEN_CLEANUP_URL = 'https://dash.cloudflare.com/profile/api-tokens';
export const DEVELOPER_INSTALL_URL =
  'https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker';

type Props = { api?: InstallerApi };
type Screen = 'token' | 'config' | 'installing' | 'result';

function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

function errorCode(error: unknown): string {
  return error instanceof InstallerClientError ? error.code : 'installation-failed';
}

export function App({ api = browserInstallerApi }: Props) {
  const [locale, setLocale] = useState<Locale>('fa');
  const [screen, setScreen] = useState<Screen>('token');
  const [tokenInput, setTokenInput] = useState('');
  const [accounts, setAccounts] = useState<CloudflareAccountView[]>([]);
  const [accountId, setAccountId] = useState('');
  const [workerName, setWorkerName] = useState('tehran-network-edge');
  const [adminPassword, setAdminPassword] = useState('');
  const [usedPassword, setUsedPassword] = useState('');
  const [result, setResult] = useState<InstallResult | null>(null);
  const [error, setError] = useState('');
  const vault = useMemo(() => createVolatileTokenVault(), []);
  const t = createTranslator(locale);
  const dir = getDirection(locale);
  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    const clean = tokenInput.trim();
    if (clean.length < 20) {
      setError(t('installer.free.invalid'));
      return;
    }
    vault.clear();
    vault.set(clean);
    setError('');
    try {
      const verified = await api.verifyToken(clean);
      if (!verified.accounts.length) {
        vault.clear();
        setTokenInput('');
        setError(t('installer.free.noAccounts'));
        return;
      }
      setAccounts(verified.accounts);
      setAccountId(verified.accounts[0]?.id ?? '');
      setTokenInput('');
      setAdminPassword(generatePassword());
      setScreen('config');
    } catch (cause) {
      vault.clear();
      setTokenInput('');
      setError(
        errorCode(cause) === 'token-invalid'
          ? t('installer.free.invalid')
          : t('installer.free.generic'),
      );
    }
  }
  async function handleInstall(event: FormEvent) {
    event.preventDefault();
    const token = vault.read();
    if (!token) {
      setError(t('installer.free.invalid'));
      setScreen('token');
      return;
    }
    setScreen('installing');
    setError('');
    try {
      const installed = await api.installPanel({ token, accountId, workerName, adminPassword });
      setUsedPassword(adminPassword);
      setResult(installed);
      setScreen('result');
    } catch {
      setError(t('installer.free.generic'));
      setScreen('token');
    } finally {
      vault.clear();
      setTokenInput('');
      setAdminPassword('');
    }
  }

  const step = screen === 'token' ? 1 : screen === 'config' ? 2 : screen === 'installing' ? 3 : 4;

  return (
    <main className="installer" dir={dir}>
      <div className="installer__aurora" aria-hidden="true" />
      <header className="installer__topbar">
        <div className="installer__brand">
          <span>
            <Cloud size={20} />
          </span>
          <strong>Tehran Network</strong>
        </div>
        <button
          className="locale-switch"
          type="button"
          onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')}
        >
          <Languages size={16} />
          {locale === 'fa' ? 'English' : 'فارسی'}
        </button>
      </header>

      <section className="installer__hero">
        <div className="installer__copy">
          <span className="installer__eyebrow">
            <Sparkles size={14} /> One-click Edge Setup
          </span>
          <h1>{t('installer.free.title')}</h1>
          <p>{t('installer.free.help')}</p>
          <div className="trust-row">
            <span>
              <ShieldCheck size={16} /> {t('installer.free.notStored')}
            </span>
            <span>
              <Check size={16} /> {t('installer.free.freeBadge')}
            </span>
          </div>
        </div>
        <div className="steps" aria-label="Installation steps">
          {[
            t('installer.free.step1'),
            t('installer.free.step2'),
            t('installer.free.step3'),
            t('installer.free.step4'),
          ].map((label, index) => (
            <div className={`step-card ${step === index + 1 ? 'is-current' : ''}`} key={label}>
              <b>{String(index + 1).padStart(2, '0')}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="installer-card">
        {screen === 'token' ? (
          <>
            <div className="token-action">
              <div className="token-action__icon">
                <KeyRound size={24} />
              </div>
              <div>
                <strong>{t('installer.free.generate')}</strong>
                <p>{t('installer.free.generateHelp')}</p>
              </div>
              <a href={CLOUDFLARE_TOKEN_TEMPLATE_URL} target="_blank" rel="noreferrer noopener">
                {t('installer.free.generate')} <ArrowUpRight size={16} />
              </a>
            </div>
            <form className="token-form" onSubmit={handleVerify}>
              <label htmlFor="cloudflare-token">{t('installer.free.tokenLabel')}</label>
              <div className="token-input-wrap">
                <input
                  id="cloudflare-token"
                  aria-label="Cloudflare API Token"
                  type="password"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  placeholder={t('installer.free.tokenPlaceholder')}
                  autoComplete="off"
                  spellCheck={false}
                />
                <Copy size={17} aria-hidden="true" />
              </div>
              <button className="install-button" type="submit">
                {t('installer.free.verify')}
              </button>
              {error ? (
                <p className="installer-message is-error" role="alert">
                  {error}
                </p>
              ) : null}
            </form>
          </>
        ) : null}

        {screen === 'config' || screen === 'installing' ? (
          <form className="oauth-form" onSubmit={handleInstall}>
            <label htmlFor="cloudflare-account">{t('installer.free.account')}</label>
            <select
              id="cloudflare-account"
              aria-label={t('installer.free.account')}
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              disabled={screen === 'installing'}
            >
              {accounts.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <label htmlFor="worker-name">{t('installer.free.worker')}</label>
            <input
              id="worker-name"
              aria-label={t('installer.free.worker')}
              value={workerName}
              onChange={(event) => setWorkerName(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={screen === 'installing'}
            />
            <label htmlFor="admin-password">{t('installer.free.password')}</label>
            <div className="password-row">
              <input
                id="admin-password"
                aria-label={t('installer.free.password')}
                type="text"
                minLength={1}
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                autoComplete="new-password"
                spellCheck={false}
                disabled={screen === 'installing'}
              />
              <button
                type="button"
                className="password-regen"
                title={t('installer.free.newPassword')}
                onClick={() => setAdminPassword(generatePassword())}
                disabled={screen === 'installing'}
              >
                <Sparkles size={15} /> {t('installer.free.newPassword')}
              </button>
            </div>
            <p className="password-hint">{t('installer.free.autoPasswordHint')}</p>
            <button className="install-button" type="submit" disabled={screen === 'installing'}>
              {screen === 'installing'
                ? t('installer.free.installing')
                : t('installer.free.install')}
            </button>
          </form>
        ) : null}

        {screen === 'result' && result ? (
          <div className="result-card">
            <span className="result-card__icon">
              <Check size={24} />
            </span>
            <div>
              <strong>{t('installer.free.ready')}</strong>
              <p>{result.adminUrl}</p>
              <p>{result.workerUrl}</p>
              <p className="result-password">
                <b>{t('installer.free.yourPassword')}:</b> <code>{usedPassword}</code>
              </p>
            </div>
            <button
              type="button"
              className="result-card__copy-password"
              onClick={() => void navigator.clipboard?.writeText(usedPassword)}
            >
              <Copy size={16} /> {t('installer.free.yourPassword')}
            </button>
            <div className="result-card__actions">
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(result.workerUrl)}
              >
                <Copy size={16} /> {t('installer.oauth.copy')}
              </button>
              <a href={result.adminUrl} target="_blank" rel="noreferrer noopener">
                {t('installer.free.openAdmin')} <ArrowUpRight size={16} />
              </a>
              <a href={result.workerUrl} target="_blank" rel="noreferrer noopener">
                {t('installer.free.openWorker')} <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        ) : null}
        {screen === 'result' ? (
          <div className="advanced-panel" style={{ marginTop: 16 }}>
            <p>{t('installer.free.cleanupHelp')}</p>
            <a
              className="developer-link"
              href={CLOUDFLARE_TOKEN_CLEANUP_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('installer.free.cleanupKey')} <ArrowUpRight size={15} />
            </a>
          </div>
        ) : null}

        <details className="advanced-install">
          <summary className="advanced-toggle">Developer / Advanced install</summary>
          <div className="advanced-panel">
            <p>Git-based deployment is optional and is not required for normal users.</p>
            <a
              className="developer-link"
              href={DEVELOPER_INSTALL_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              Developer install <ArrowUpRight size={15} />
            </a>
          </div>
        </details>
      </section>
    </main>
  );
}
