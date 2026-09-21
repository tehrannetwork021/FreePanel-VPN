import { useState, type FormEvent } from 'react';
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
import type { InstallResult } from '@tehrannetwork/shared';
import { createTranslator, getDirection, type Locale } from '@tehrannetwork/i18n';
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
type Props = { api?: InstallerApi };
type Screen = 'token' | 'verifying' | 'installing' | 'result';

function errorCode(error: unknown): string {
  return error instanceof InstallerClientError ? error.code : 'installation-failed';
}

export function App({ api = browserInstallerApi }: Props) {
  const [locale, setLocale] = useState<Locale>('fa');
  const [screen, setScreen] = useState<Screen>('token');
  const [tokenInput, setTokenInput] = useState('');
  const [usedPassword, setUsedPassword] = useState('');
  const [result, setResult] = useState<InstallResult | null>(null);
  const [error, setError] = useState('');
  const t = createTranslator(locale);
  const dir = getDirection(locale);
  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    const token = tokenInput.trim();
    if (token.length < 20) {
      setError(t('installer.free.invalid'));
      return;
    }

    setTokenInput('');
    setError('');
    setScreen('installing');

    try {
      const installed = await api.installPanel({ token });
      setUsedPassword(installed.adminPassword);
      setResult(installed);
      setScreen('result');
    } catch (cause) {
      const code = errorCode(cause);
      setError(
        code === 'token-invalid'
          ? t('installer.free.invalid')
          : code === 'invalid-account'
            ? t('installer.free.noAccounts')
            : t('installer.free.generic'),
      );
      setScreen('token');
    }
  }

  const step =
    screen === 'token' ? 1 : screen === 'verifying' ? 2 : screen === 'installing' ? 3 : 4;

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

        {screen === 'verifying' || screen === 'installing' ? (
          <div className="oauth-form" role="status">
            <strong>
              {screen === 'verifying'
                ? t('installer.free.verifying')
                : t('installer.free.installing')}
            </strong>
          </div>
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
      </section>
    </main>
  );
}
