import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import type { TranslationKey } from '@tehrannetwork/i18n';
import type { CreateUserInput, PanelApi, UserRecord } from '../api/client';
import { PanelApiError } from '../api/client';
import { UserEditor } from '../components/UserEditor';
import { UserAccess } from '../components/UserAccess';
import { formatBytes } from './OverviewPage';

type T = (key: TranslationKey) => string;
type Props = { api: PanelApi; t: T; onUnauthorized(): void };

export function UsersPage({ api, t, onUnauthorized }: Props) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editor, setEditor] = useState<UserRecord | 'new' | null>(null);
  const [accessUser, setAccessUser] = useState<UserRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const handleError = (cause: unknown) => {
    if (cause instanceof PanelApiError && cause.status === 401) onUnauthorized();
    else setError(true);
  };
  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setUsers(await api.listUsers());
    } catch (cause) {
      handleError(cause);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  async function save(input: CreateUserInput) {
    setBusy(true);
    setError(false);
    try {
      if (editor === 'new') {
        const created = await api.createUser(input);
        setUsers((current) => [created, ...current]);
      } else if (editor) {
        const updated = await api.updateUser(editor.id, { ...input, version: editor.version });
        setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
      }
      setEditor(null);
    } catch (cause) {
      handleError(cause);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(user: UserRecord) {
    setBusy(true);
    try {
      const updated = await api.updateUser(user.id, {
        version: user.version,
        enabled: !user.enabled,
      });
      setUsers((current) => current.map((item) => (item.id === user.id ? updated : item)));
    } catch (cause) {
      handleError(cause);
    } finally {
      setBusy(false);
    }
  }
  async function rotateSubscription(user: UserRecord) {
    setBusy(true);
    try {
      await api.rotateSubscription(user.id);
    } catch (cause) {
      handleError(cause);
    } finally {
      setBusy(false);
    }
  }
  async function remove(user: UserRecord) {
    if (typeof window !== 'undefined' && !window.confirm(t('panel.users.confirmDelete'))) return;
    setBusy(true);
    try {
      await api.deleteUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
    } catch (cause) {
      handleError(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="control-page" aria-labelledby="users-title">
      <div className="page-heading">
        <h1 id="users-title">{t('panel.users.title')}</h1>
        <button className="primary-button" type="button" onClick={() => setEditor('new')}>
          <Plus size={16} /> {t('panel.users.new')}
        </button>
      </div>
      {error ? (
        <div className="page-state is-error">
          <span>{t('panel.common.error')}</span>
          <button type="button" onClick={() => void load()}>
            {t('panel.common.retry')}
          </button>
        </div>
      ) : null}
      {loading ? <div className="page-state">{t('panel.common.loading')}</div> : null}
      {!loading && !users.length ? (
        <div className="empty-card">{t('panel.users.empty')}</div>
      ) : null}
      {users.length ? (
        <div className="user-list">
          {users.map((user) => (
            <article className="user-card" key={user.id}>
              <div className="user-card__head">
                <div>
                  <strong>{user.name}</strong>
                  <span className={user.enabled ? 'status-pill is-on' : 'status-pill is-off'}>
                    {user.enabled ? t('panel.users.enabled') : t('panel.users.paused')}
                  </span>
                </div>
                <span className="user-usage">
                  {t('panel.users.usage')}: {formatBytes(user.totalUsedBytes)}
                </span>
              </div>
              <div className="user-meta">
                <span>
                  {t('panel.users.quota')}:{' '}
                  <b>
                    {user.quotaBytes === null
                      ? t('panel.users.unlimited')
                      : formatBytes(user.quotaBytes)}
                  </b>
                </span>
                <span>
                  {t('panel.users.dailyQuota')}:{' '}
                  <b>
                    {user.dailyQuotaBytes === null
                      ? t('panel.users.unlimited')
                      : formatBytes(user.dailyQuotaBytes)}
                  </b>
                </span>
                <span>
                  {t('panel.users.expiry')}:{' '}
                  <b>
                    {user.expiresAt
                      ? new Date(user.expiresAt).toLocaleString()
                      : t('panel.users.never')}
                  </b>
                </span>
                <span>
                  {t('panel.users.protocols')}:{' '}
                  <b>
                    {[
                      user.allowVless && 'VLESS',
                      user.allowTrojan && 'Trojan',
                      user.allowXhttp && 'XHTTP',
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </b>
                </span>
              </div>
              <div className="user-actions">
                <button type="button" disabled={busy} onClick={() => void toggle(user)}>
                  {user.enabled ? t('panel.users.pause') : t('panel.users.resume')}
                </button>
                <button type="button" onClick={() => setEditor(user)}>
                  <Pencil size={14} /> {t('panel.users.edit')}
                </button>
                <button type="button" onClick={() => setAccessUser(user)}>
                  <KeyRound size={14} /> {t('panel.users.access')}
                </button>
                <button type="button" disabled={busy} onClick={() => void rotateSubscription(user)}>
                  <RefreshCw size={14} /> {t('panel.users.rotateSubscription')}
                </button>
                <button
                  className="danger-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(user)}
                >
                  <Trash2 size={14} /> {t('panel.users.delete')}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {editor ? (
        <div className="modal-backdrop" role="presentation">
          <section className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h2>{editor === 'new' ? t('panel.users.new') : t('panel.users.edit')}</h2>
              <button
                className="icon-button"
                type="button"
                aria-label={t('panel.common.close')}
                onClick={() => setEditor(null)}
              >
                <X size={18} />
              </button>
            </div>
            <UserEditor
              t={t}
              user={editor === 'new' ? null : editor}
              busy={busy}
              onSave={save}
              onCancel={() => setEditor(null)}
            />
          </section>
        </div>
      ) : null}
      {accessUser ? (
        <UserAccess
          api={api}
          user={accessUser}
          t={t}
          onUnauthorized={onUnauthorized}
          onClose={() => setAccessUser(null)}
        />
      ) : null}
    </section>
  );
}
