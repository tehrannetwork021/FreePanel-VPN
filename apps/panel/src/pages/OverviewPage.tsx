import { useEffect, useState } from 'react';
import { AlertTriangle, Clock3, Database, UsersRound, Zap } from 'lucide-react';
import type { TranslationKey } from '@tehrannetwork/i18n';
import type { Overview, PanelApi } from '../api/client';
import { PanelApiError } from '../api/client';

type T = (key: TranslationKey) => string;
type Props = { api: PanelApi; t: T; onUnauthorized(): void };

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  const digits = index === 0 ? 0 : amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(digits)} ${units[index]}`;
}

export function OverviewPage({ api, t, onUnauthorized }: Props) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);
  const load = async () => {
    setError(false);
    try {
      setData(await api.overview());
    } catch (cause) {
      if (cause instanceof PanelApiError && cause.status === 401) onUnauthorized();
      else setError(true);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  if (!data && !error) return <div className="page-state">{t('panel.common.loading')}</div>;
  if (error)
    return (
      <div className="page-state is-error">
        <span>{t('panel.common.error')}</span>
        <button type="button" onClick={() => void load()}>
          {t('panel.common.retry')}
        </button>
      </div>
    );
  if (!data) return null;

  const cards = [
    [t('panel.overview.enabledUsers'), String(data.enabledUsers), <UsersRound size={19} />],
    [t('panel.overview.recentUsers'), String(data.recentUsers), <Clock3 size={19} />],
    [t('panel.overview.todayUsage'), formatBytes(data.todayBytes), <Zap size={19} />],
    [t('panel.overview.totalUsage'), formatBytes(data.totalBytes), <Database size={19} />],
    [t('panel.overview.expiryWarnings'), String(data.expiryWarnings), <AlertTriangle size={19} />],
  ] as const;

  return (
    <section className="control-page" aria-labelledby="overview-title">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Cloudflare Edge Control</span>
          <h1 id="overview-title">{t('panel.overview.title')}</h1>
        </div>
      </div>
      <div className="overview-grid">
        {cards.map(([label, value, icon]) => (
          <article className="metric-card-real" key={label}>
            <span className="metric-card-real__icon">{icon}</span>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="info-strip">
        <Zap size={16} />
        <span>{t('panel.overview.quotaNote')}</span>
      </div>
    </section>
  );
}
