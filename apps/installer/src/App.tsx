import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
import type { InstallResult, InstallerSessionView } from '@tehrannetwork/shared';
import { createTranslator, getDirection, type Locale } from '@tehrannetwork/i18n';
import { createVolatileTokenVault } from './tokenVault';
import {
  browserInstallerApi,
  InstallerClientError,
  startTokenInstall,
  type InstallerApi,
  type TokenInstallFn,
} from './installClient';
import './app.css';

const permissions = [
  { key: 'workers_scripts', type: 'edit' },
  { key: 'workers_kv_storage', type: 'edit' },
  { key: 'workers_routes', type: 'edit' },
];

export const CLOUDFLARE_TOKEN_TEMPLATE_URL =
  `https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=${encodeURIComponent(JSON.stringify(permissions))}` +
  '&accountId=%2A&zoneId=all&name=Tehran%20Network%20Installer';

export const DEVELOPER_INSTALL_URL =
  'https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker';

type Props = {
  api?: InstallerApi;
  tokenInstall?: TokenInstallFn;
};

type ScreenState = 'loading' | 'disconnected' | 'connected' | 'installing' | 'result';

function errorCode(error: unknown): string {
  return error instanceof InstallerClientError ? error.code : 'installation-failed';
}

export function App({ api = browserInstallerApi, tokenInstall = startTokenInstall }: Props) {
  const [locale, setLocale] = useState<Locale>('fa');
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [session, setSession] = useState<InstallerSessionView>({ connected: false });
  const [accountId, setAccountId] = useState('');
  const [workerName, setWorkerName] = useState('tehran-network-edge');
  const [adminPassword, setAdminPassword] = useState('');
  const [result, setResult] = useState<InstallResult | null>(null);
  const [error, setError] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [token, setToken] = useState('');
  const [advancedMessage, setAdvancedMessage] = useState('');
  const vault = useMemo(() => createVolatileTokenVault(), []);
  const t = createTranslator(locale);
  const dir = getDirection(locale);

  useEffect(() => {
    let active = true;
    const callbackError = new URLSearchParams(window.location.search).get('error') ?? '';
    if (callbackError) setError(callbackError);
    void api
      .getSession()
      .then((view) => {
        if (!active) return;
        setSession(view);
        if (view.connected) {
          setAccountId(view.accounts?.[0]?.id ?? '');
          setScreen('connected');
          setError('');
        } else {
          setScreen('disconnected');
        }
      })
      .catch((cause) => {
        if (!active) return;
        setError(errorCode(cause));
        setScreen('disconnected');
      });
    return () => {
      active = false;
    };
  }, [api]);

  async function handleInstall(event: FormEvent) {
    event.preventDefault();
    setScreen('installing');
    setError('');
    try {
      const installed = await api.installPanel({ accountId, workerName, adminPassword });
      setAdminPassword('');
      setResult(installed);
      setScreen('result');
    } catch (cause) {
      setAdminPassword('');
      setError(errorCode(cause));
      setScreen('connected');
    }
  }

  async function handleAdvancedInstall(event: FormEvent) {
    event.preventDefault();
    const clean = token.trim();
    if (clean.length < 20) {
      setAdvancedMessage(t('installer.token.invalid'));
      return;
    }
    vault.set(clean);
    setAdvancedMessage('');
    try {
      await tokenInstall(vault.read()!);
      setAdvancedMessage(t('installer.progress.done'));
    } catch {
      setAdvancedMessage(t('installer.oauth.generic'));
    } finally {
      vault.clear();
      setToken('');
    }
  }

  const authorizationMessage =
    error === 'authorization-expired'
      ? t('installer.oauth.expired')
      : error === 'insufficient-scope'
        ? t('installer.oauth.insufficient')
        : error
          ? t('installer.oauth.generic')
          : '';
  const step = screen === 'result' ? 4 : screen === 'connected' || screen === 'installing' ? 3 : 1;

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
          <h1>{t('installer.oauth.title')}</h1>
          <p>{t('installer.oauth.help')}</p>
          <div className="trust-row">
            <span>
              <ShieldCheck size={16} /> {t('installer.oauth.private')}
            </span>
            <span>
              <Check size={16} /> No VPS required
            </span>
          </div>
        </div>

        <div className="steps" aria-label="Installation steps">
          {[
            t('installer.oauth.step1'),
            t('installer.oauth.step2'),
            t('installer.oauth.step3'),
            t('installer.oauth.step4'),
          ].map((label, index) => (
            <div className={`step-card ${step === index + 1 ? 'is-current' : ''}`} key={label}>
              <b>{String(index + 1).padStart(2, '0')}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="installer-card">
        {screen === 'loading' ? (
          <div className="oauth-status">
            <Cloud size={25} />
            <strong>{t('installer.oauth.loading')}</strong>
          </div>
        ) : null}

        {screen === 'disconnected' ? (
          <div className="oauth-action">
            <div className="token-action__icon">
              <Cloud size={25} />
            </div>
            <div>
              <strong>{t('installer.oauth.title')}</strong>
              <p>{authorizationMessage || t('installer.oauth.help')}</p>
            </div>
            <button className="install-button" type="button" onClick={() => api.startOAuth()}>
              {error === 'authorization-expired'
                ? t('installer.oauth.reconnect')
                : error === 'insufficient-scope'
                  ? t('installer.oauth.reauthorize')
                  : t('installer.oauth.cta')}
            </button>
          </div>
        ) : null}

        {screen === 'connected' || screen === 'installing' ? (
          <form className="oauth-form" onSubmit={handleInstall}>
            <div className="oauth-connected">
              <Check size={17} /> {t('installer.oauth.connected')}
            </div>
            <label htmlFor="cloudflare-account">{t('installer.oauth.account')}</label>
            <select
              id="cloudflare-account"
              aria-label={t('installer.oauth.account')}
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              disabled={screen === 'installing'}
            >
              {(session.accounts ?? []).map((account) => (
                <option value={account.id} key={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <label htmlFor="worker-name">{t('installer.oauth.worker')}</label>
            <input
              id="worker-name"
              aria-label={t('installer.oauth.worker')}
              value={workerName}
              onChange={(event) => setWorkerName(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={screen === 'installing'}
            />
            <label htmlFor="admin-password">{t('installer.oauth.password')}</label>
            <input
              id="admin-password"
              aria-label={t('installer.oauth.password')}
              type="password"
              minLength={16}
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              autoComplete="new-password"
              disabled={screen === 'installing'}
            />
            <button className="install-button" type="submit" disabled={screen === 'installing'}>
              {screen === 'installing'
                ? t('installer.oauth.installing')
                : t('installer.oauth.install')}
            </button>
            {authorizationMessage ? (
              <p className="installer-message is-error" role="alert">
                {authorizationMessage}
              </p>
            ) : null}
          </form>
        ) : null}

        {screen === 'result' && result ? (
          <div className="result-card">
            <span className="result-card__icon">
              <Check size={24} />
            </span>
            <div>
              <strong>{t('installer.oauth.resultTitle')}</strong>
              <p>{result.workerUrl}</p>
            </div>
            <div className="result-card__actions">
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(result.workerUrl)}
              >
                <Copy size={16} /> {t('installer.oauth.copy')}
              </button>
              <a href={result.workerUrl} target="_blank" rel="noreferrer noopener">
                {t('installer.oauth.open')} <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        ) : null}

        <div className="advanced-install">
          <button
            className="advanced-toggle"
            type="button"
            aria-expanded={advanced}
            onClick={() => setAdvanced((value) => !value)}
          >
            {t('installer.oauth.advanced')}
          </button>
          {advanced ? (
            <div className="advanced-panel">
              <p>{t('installer.oauth.advancedHelp')}</p>
              <div className="token-action">
                <div className="token-action__icon">
                  <KeyRound size={22} />
                </div>
                <div>
                  <strong>{t('installer.token.get')}</strong>
                  <p>{t('installer.token.getHelp')}</p>
                </div>
                <a
                  href={CLOUDFLARE_TOKEN_TEMPLATE_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  referrerPolicy="no-referrer"
                >
                  {t('installer.token.get')} <ArrowUpRight size={16} />
                </a>
              </div>
              <form className="token-form" onSubmit={handleAdvancedInstall}>
                <label htmlFor="cloudflare-token">Cloudflare API Token</label>
                <div className="token-input-wrap">
                  <input
                    id="cloudflare-token"
                    aria-label="Cloudflare API Token"
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder={t('installer.token.placeholder')}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Copy size={17} aria-hidden="true" />
                </div>
                <button className="install-button" type="submit">
                  {t('installer.token.continue')}
                </button>
                {advancedMessage ? <p className="installer-message">{advancedMessage}</p> : null}
              </form>
              <a
                className="developer-link"
                href={DEVELOPER_INSTALL_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                Developer install <ArrowUpRight size={15} />
              </a>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
