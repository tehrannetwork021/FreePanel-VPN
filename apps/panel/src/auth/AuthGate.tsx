import { useState, type FormEvent, type ReactNode } from 'react';
import type { TranslationKey } from '@tehrannetwork/i18n';
import type { PanelApi } from '../api/client';

type T = (key: TranslationKey) => string;

type Props = {
  api: PanelApi;
  authenticated: boolean | null;
  t: T;
  onAuthenticated(): void;
  onAuthLost(): void;
  children: ReactNode;
};

export function AuthGate({ api, authenticated, t, onAuthenticated, onAuthLost, children }: Props) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.login(password);
      setPassword('');
      onAuthenticated();
    } catch {
      onAuthLost();
      setError(t('panel.login.invalid'));
    } finally {
      setBusy(false);
    }
  }

  if (authenticated === null) {
    return <div className="auth-gate auth-gate--checking">{t('panel.login.checking')}</div>;
  }
  if (authenticated) return <>{children}</>;

  return (
    <div className="auth-gate">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-card__brand">TEHRAN NETWORK · EDGE PANEL</div>
        <h1>{t('panel.login.title')}</h1>
        <p>{t('panel.login.subtitle')}</p>
        <label htmlFor="panel-admin-password">{t('panel.login.password')}</label>
        <input
          id="panel-admin-password"
          aria-label={t('panel.login.password')}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
        <button className="primary-button" type="submit" disabled={busy || !password}>
          {busy ? t('panel.login.checking') : t('panel.login.submit')}
        </button>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
