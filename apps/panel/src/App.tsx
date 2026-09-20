import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Gauge, Languages, RadioTower, ShieldCheck, UsersRound } from 'lucide-react';
import { createTranslator, getDirection, type Locale } from '@tehrannetwork/i18n';
import { AuthGate } from './auth/AuthGate';
import { browserPanelApi, type PanelApi } from './api/client';
import { OverviewPage } from './pages/OverviewPage';
import { UsersPage } from './pages/UsersPage';
import { UsagePage } from './pages/UsagePage';
import { SecurityPage } from './pages/SecurityPage';
import './app.css';

type Page = 'overview' | 'users' | 'usage' | 'security';
type Props = { api?: PanelApi };

export function App({ api = browserPanelApi }: Props) {
  const [locale, setLocale] = useState<Locale>('fa');
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [page, setPage] = useState<Page>('overview');
  const t = useMemo(() => createTranslator(locale), [locale]);
  const dir = getDirection(locale);

  useEffect(() => {
    let active = true;
    api
      .session()
      .then((session) => {
        if (active) setAuthenticated(session.authenticated);
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  const nav = [
    { id: 'overview' as const, label: t('nav.overview'), icon: <Gauge size={17} /> },
    { id: 'users' as const, label: t('nav.users'), icon: <UsersRound size={17} /> },
    { id: 'usage' as const, label: t('nav.usage'), icon: <BarChart3 size={17} /> },
    { id: 'security' as const, label: t('nav.securityLogs'), icon: <ShieldCheck size={17} /> },
  ];
  const loseAuth = () => setAuthenticated(false);

  return (
    <div className="panel-root" dir={dir}>
      <AuthGate
        api={api}
        authenticated={authenticated}
        t={t}
        onAuthenticated={() => setAuthenticated(true)}
        onAuthLost={loseAuth}
      >
        <div className="control-shell" data-testid="dashboard" dir={dir}>
          <aside className="control-rail">
            <div className="panel-brand">
              <span className="panel-brand__mark">
                <RadioTower size={21} />
              </span>
              <div>
                <strong>Tehran Network</strong>
                <small>Edge Control Plane</small>
              </div>
            </div>
            <nav className="control-nav" aria-label="Primary navigation">
              {nav.map((item) => (
                <button
                  className={page === item.id ? 'is-active' : ''}
                  type="button"
                  key={item.id}
                  onClick={() => setPage(item.id)}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <button
              className="rail-language"
              type="button"
              aria-label={locale === 'fa' ? 'English' : 'فارسی'}
              onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')}
            >
              <Languages size={16} />
              <span>{locale === 'fa' ? 'English' : 'فارسی'}</span>
            </button>
          </aside>
          <main className="control-main">
            <header className="mobile-topbar">
              <div className="panel-brand panel-brand--mobile">
                <span className="panel-brand__mark">
                  <RadioTower size={19} />
                </span>
                <strong>Tehran Network</strong>
              </div>
            </header>
            <div className="control-content">
              {page === 'overview' ? (
                <OverviewPage api={api} t={t} onUnauthorized={loseAuth} />
              ) : null}
              {page === 'users' ? <UsersPage api={api} t={t} onUnauthorized={loseAuth} /> : null}
              {page === 'usage' ? <UsagePage api={api} t={t} onUnauthorized={loseAuth} /> : null}
              {page === 'security' ? (
                <SecurityPage api={api} t={t} onUnauthorized={loseAuth} onLoggedOut={loseAuth} />
              ) : null}
            </div>
          </main>
        </div>
      </AuthGate>
    </div>
  );
}
