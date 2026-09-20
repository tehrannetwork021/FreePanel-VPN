import { useEffect, useMemo, useState } from 'react';
import { Copy, RefreshCw, X } from 'lucide-react';
import { renderSVG } from 'uqr';
import type { TranslationKey } from '@tehrannetwork/i18n';
import type { PanelApi, UserAccess as Access, UserRecord } from '../api/client';
import { PanelApiError } from '../api/client';

type T = (key: TranslationKey) => string;
type Props = { api: PanelApi; user: UserRecord; t: T; onUnauthorized(): void; onClose(): void };

export function UserAccess({ api, user, t, onUnauthorized, onClose }: Props) {
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');

  const load = async () => {
    setError(false);
    try {
      setAccess(await api.userAccess(user.id));
    } catch (cause) {
      if (cause instanceof PanelApiError && cause.status === 401) onUnauthorized();
      else setError(true);
    }
  };
  useEffect(() => {
    void load();
  }, [user.id]);
  const qr = useMemo(
    () => (access ? renderSVG(access.qr.payload, { ecc: 'M', border: 2 }) : ''),
    [access],
  );

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard?.writeText(value);
    } catch {
      /* clipboard is best-effort */
    }
    setCopied(label);
    setTimeout(() => setCopied(''), 1200);
  }
  async function rotate(kind: 'subscription' | 'vless' | 'trojan' | 'all') {
    setBusy(kind);
    try {
      if (kind === 'subscription') await api.rotateSubscription(user.id);
      else await api.rotateCredentials(user.id, kind);
      await load();
    } catch (cause) {
      if (cause instanceof PanelApiError && cause.status === 401) onUnauthorized();
      else setError(true);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-card access-card"
        role="dialog"
        aria-modal="true"
        aria-label={t('panel.access.title')}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">{user.name}</span>
            <h2>{t('panel.access.title')}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label={t('panel.common.close')}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {!access && !error ? <div className="page-state">{t('panel.common.loading')}</div> : null}
        {error ? (
          <div className="page-state is-error">
            <span>{t('panel.common.error')}</span>
            <button type="button" onClick={() => void load()}>
              {t('panel.common.retry')}
            </button>
          </div>
        ) : null}
        {access ? (
          <>
            <div className="access-grid">
              <div className="qr-box" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="secret-list">
                <SecretRow
                  label={t('panel.access.subscription')}
                  value={access.subscriptionUrl}
                  onCopy={() => void copy('sub', access.subscriptionUrl)}
                  copied={copied === 'sub'}
                  t={t}
                />
                <SecretRow
                  label={t('panel.access.vless')}
                  value={access.vless.uuid}
                  onCopy={() => void copy('vless', access.vless.uuid)}
                  copied={copied === 'vless'}
                  t={t}
                />
                <SecretRow
                  label={t('panel.access.trojan')}
                  value={access.trojan.password}
                  onCopy={() => void copy('trojan', access.trojan.password)}
                  copied={copied === 'trojan'}
                  t={t}
                />
              </div>
            </div>
            <div className="rotation-grid">
              <button type="button" disabled={!!busy} onClick={() => void rotate('subscription')}>
                <RefreshCw size={15} /> {t('panel.users.rotateSubscription')}
              </button>
              <button type="button" disabled={!!busy} onClick={() => void rotate('vless')}>
                <RefreshCw size={15} /> {t('panel.access.rotateVless')}
              </button>
              <button type="button" disabled={!!busy} onClick={() => void rotate('trojan')}>
                <RefreshCw size={15} /> {t('panel.access.rotateTrojan')}
              </button>
              <button type="button" disabled={!!busy} onClick={() => void rotate('all')}>
                <RefreshCw size={15} /> {t('panel.access.rotateAll')}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function SecretRow({
  label,
  value,
  onCopy,
  copied,
  t,
}: {
  label: string;
  value: string;
  onCopy(): void;
  copied: boolean;
  t: T;
}) {
  return (
    <div className="secret-row">
      <span>{label}</span>
      <div>
        <code>{value}</code>
        <button
          className="icon-button"
          type="button"
          aria-label={`${t('panel.common.copy')} ${label}`}
          onClick={onCopy}
        >
          <Copy size={15} /> {copied ? t('panel.common.copied') : ''}
        </button>
      </div>
    </div>
  );
}
