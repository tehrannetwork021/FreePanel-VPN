import { useMemo, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, Cloud, Copy, KeyRound, Languages, ShieldCheck, Sparkles } from 'lucide-react';
import { createTranslator, getDirection, type Locale } from '@tehrannetwork/i18n';
import { createVolatileTokenVault } from './tokenVault';
import { startLocalInstall, type InstallFn } from './installClient';
import './app.css';

const permissions = [
  { key: 'workers_scripts', type: 'edit' },
  { key: 'workers_kv_storage', type: 'edit' },
  { key: 'workers_routes', type: 'edit' },
];

export const CLOUDFLARE_TOKEN_TEMPLATE_URL =
  `https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=${encodeURIComponent(JSON.stringify(permissions))}` +
  '&accountId=%2A&zoneId=all&name=Tehran%20Network%20Installer';

type Props = { install?: InstallFn };
type State = 'idle' | 'installing' | 'success' | 'error';

export function App({ install = startLocalInstall }: Props) {
  const [locale, setLocale] = useState<Locale>('fa');
  const [token, setToken] = useState('');
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');
  const vault = useMemo(() => createVolatileTokenVault(), []);
  const t = createTranslator(locale);
  const dir = getDirection(locale);
  async function handleInstall(event: FormEvent) {
    event.preventDefault();
    const clean = token.trim();
    if (clean.length < 20) {
      setState('error');
      setMessage(t('installer.token.invalid'));
      return;
    }

    vault.set(clean);
    setState('installing');
    setMessage('');
    try {
      await install(vault.read()!);
      setState('success');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Installation failed.');
    } finally {
      vault.clear();
      setToken('');
    }
  }

  return (
    <main className="installer" dir={dir}>
      <div className="installer__aurora" aria-hidden="true" />
      <header className="installer__topbar">
        <div className="installer__brand"><span><Cloud size={20} /></span><strong>Tehran Network</strong></div>
        <button className="locale-switch" type="button" onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')}>
          <Languages size={16} />{locale === 'fa' ? 'English' : 'فارسی'}
        </button>
      </header>
      <section className="installer__hero">
        <div className="installer__copy">
          <span className="installer__eyebrow"><Sparkles size={14} /> One-click Edge Setup</span>
          <h1>{t('installer.token.title')}</h1>
          <p>{t('installer.token.help')}</p>
          <div className="trust-row">
            <span><ShieldCheck size={16} /> {t('installer.token.neverStored')}</span>
            <span><Check size={16} /> No VPS required</span>
          </div>
        </div>

        <div className="steps" aria-label="Installation steps">
          <div className="step-card is-current"><b>01</b><span>{t('installer.token.step1')}</span></div>
          <div className="step-card"><b>02</b><span>{t('installer.token.step2')}</span></div>
          <div className="step-card"><b>03</b><span>{t('installer.token.step3')}</span></div>
        </div>
      </section>

      <section className="installer-card">
        <div className="token-action">
          <div className="token-action__icon"><Cloud size={25} /></div>
          <div><strong>{t('installer.token.get')}</strong><p>{t('installer.token.getHelp')}</p></div>
          <a href={CLOUDFLARE_TOKEN_TEMPLATE_URL} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer">
            {t('installer.token.get')} <ArrowUpRight size={17} />
          </a>
        </div>

        <div className="flow-divider"><span /><b>THEN</b><span /></div>

        <form onSubmit={handleInstall} className="token-form">
          <label htmlFor="cloudflare-token"><KeyRound size={17} /> Cloudflare API Token</label>
          <div className="token-input-wrap">
            <input id="cloudflare-token" aria-label="Cloudflare API Token" type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder={t('installer.token.placeholder')} autoComplete="off" spellCheck={false} />
            <Copy size={17} aria-hidden="true" />
          </div>
          <button className="install-button" type="submit" disabled={state === 'installing'}>
            {state === 'installing' ? t('installer.progress.verify') : t('installer.token.continue')}
          </button>
          {message ? <p className="installer-message is-error" role="alert">{message}</p> : null}
          {state === 'success' ? <p className="installer-message is-success"><Check size={16} /> {t('installer.progress.done')}</p> : null}
        </form>

        <div className="progress-strip" aria-label="Automatic installation pipeline">
          {[t('installer.progress.verify'), t('installer.progress.account'), t('installer.progress.kv'), t('installer.progress.worker')].map((label, index) => (
            <div className={state === 'success' ? 'progress-item is-done' : state === 'installing' && index === 0 ? 'progress-item is-active' : 'progress-item'} key={label}>
              <span>{state === 'success' ? <Check size={13} /> : index + 1}</span><small>{label}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
