import { useEffect, useState } from 'react';
import type { TranslationKey } from '@tehrannetwork/i18n';
import type { PanelApi, UsagePoint } from '../api/client';
import { PanelApiError } from '../api/client';
import { formatBytes } from './OverviewPage';

type T = (key: TranslationKey) => string;
type Props = { api: PanelApi; t: T; onUnauthorized(): void };

export function UsagePage({ api, t, onUnauthorized }: Props) {
  const [days, setDays] = useState(14);
  const [rows, setRows] = useState<UsagePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      setRows(await api.aggregateUsage(days));
    } catch (cause) {
      if (cause instanceof PanelApiError && cause.status === 401) onUnauthorized();
      else setError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [days]);

  return (
    <section className="control-page" aria-labelledby="usage-title">
      <div className="page-heading">
        <h1 id="usage-title">{t('panel.usage.title')}</h1>
        <label className="inline-select">
          {t('panel.usage.days')}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 14, 30, 90].map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
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
      {!loading && !error && !rows.length ? (
        <div className="empty-card">{t('panel.usage.empty')}</div>
      ) : null}
      {rows.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('panel.usage.date')}</th>
                <th>{t('panel.usage.upload')}</th>
                <th>{t('panel.usage.download')}</th>
                <th>{t('panel.usage.total')}</th>
                <th>{t('panel.usage.connections')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.dayUtc}>
                  <td>{row.dayUtc}</td>
                  <td>{formatBytes(row.uploadBytes)}</td>
                  <td>{formatBytes(row.downloadBytes)}</td>
                  <td>
                    <strong>{formatBytes(row.totalBytes)}</strong>
                  </td>
                  <td>{row.connections}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
