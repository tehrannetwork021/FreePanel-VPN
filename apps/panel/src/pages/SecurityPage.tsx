import { useEffect, useState, type FormEvent } from 'react';
import type { TranslationKey } from '@tehrannetwork/i18n';
import type { AuditEntry, LoginEvent, PanelApi } from '../api/client';
import { PanelApiError } from '../api/client';

type T = (key: TranslationKey) => string;
type Props = { api: PanelApi; t: T; onUnauthorized(): void; onLoggedOut(): void };

export function SecurityPage({ api, t, onUnauthorized, onLoggedOut }: Props) {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [logins, setLogins] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleError = (cause: unknown) => {
    if (cause instanceof PanelApiError && cause.status === 401) onUnauthorized();
    else setError(true);
  };
  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [entries, events] = await Promise.all([api.audit(50), api.loginEvents(50)]);
      setAudit(entries);
      setLogins(events);
    } catch (cause) {
      handleError(cause);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!currentPassword || !newPassword || busy) return;
    setBusy(true);
    setError(false);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      onLoggedOut();
    } catch (cause) {
      handleError(cause);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await api.logout();
    } catch {
      /* session may already be gone */
    } finally {
      setBusy(false);
      onLoggedOut();
    }
  }

  return (
    <section className="control-page" aria-labelledby="security-title">
      <div className="page-heading">
        <h1 id="security-title">{t('panel.security.title')}</h1>
        <button
          className="secondary-button"
          type="button"
          onClick={() => void logout()}
          disabled={busy}
        >
          {t('panel.security.logout')}
        </button>
      </div>
      {loading ? <div className="page-state">{t('panel.common.loading')}</div> : null}
      {error ? (
        <div className="page-state is-error">
          <span>{t('panel.common.error')}</span>
          <button type="button" onClick={() => void load()}>
            {t('panel.common.retry')}
          </button>
        </div>
      ) : null}
      <div className="security-grid">
        <article className="security-card">
          <h2>{t('panel.security.changePassword')}</h2>
          <form className="password-form" onSubmit={changePassword}>
            <label>
              <span>{t('panel.security.currentPassword')}</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label>
              <span>{t('panel.security.newPassword')}</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <button
              className="primary-button"
              type="submit"
              disabled={busy || !currentPassword || !newPassword}
            >
              {t('panel.security.updatePassword')}
            </button>
          </form>
        </article>
        <article className="security-card">
          <h2>{t('panel.security.logins')}</h2>
          <div className="event-list">
            {logins.length ? (
              logins.map((event, index) => (
                <div className="event-row" key={event.id ?? `${event.ts}-${index}`}>
                  <span
                    className={event.success ? 'event-dot is-success' : 'event-dot is-failure'}
                  />
                  <div>
                    <strong>
                      {event.success ? t('panel.security.success') : t('panel.security.failure')}
                    </strong>
                    <small>
                      {new Date(event.ts).toLocaleString()} ·{' '}
                      {[event.country, event.colo].filter(Boolean).join(' / ') || '—'}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <span className="muted-text">—</span>
            )}
          </div>
        </article>
      </div>
      <article className="security-card security-card--wide">
        <h2>{t('panel.security.audit')}</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('panel.security.time')}</th>
                <th>{t('panel.security.action')}</th>
                <th>{t('panel.security.actor')}</th>
                <th>{t('panel.security.target')}</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((entry, index) => (
                <tr key={entry.id ?? `${entry.ts}-${index}`}>
                  <td>{new Date(entry.ts).toLocaleString()}</td>
                  <td>
                    <code>{entry.action}</code>
                  </td>
                  <td>{entry.actor}</td>
                  <td>{entry.targetId ?? entry.target_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
