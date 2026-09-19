import { useState } from 'react';
import { Activity, Gauge, Network, RadioTower, Route, ShieldCheck, Waypoints } from 'lucide-react';
import { createTranslator, getDirection, type Locale } from '@tehrannetwork/i18n';
import { AppShell, MetricCard, NetworkStatus, type NavItem } from '@tehrannetwork/ui';
import './app.css';

export function App() {
  const [locale, setLocale] = useState<Locale>('fa');
  const t = createTranslator(locale);
  const dir = getDirection(locale);

  const nav: NavItem[] = [
    { id: 'overview', label: t('nav.overview'), icon: <Gauge size={17} />, active: true },
    { id: 'protocols', label: t('nav.protocols'), icon: <Waypoints size={17} /> },
    { id: 'endpoints', label: t('nav.endpoints'), icon: <Network size={17} /> },
    { id: 'routing', label: t('nav.routing'), icon: <Route size={17} /> },
    { id: 'security', label: t('nav.security'), icon: <ShieldCheck size={17} /> },
  ];

  return (
    <div data-testid="dashboard" dir={dir}>
      <AppShell dir={dir} brand="Tehran Network" navigation={nav} localeLabel={locale.toUpperCase()}>
        <header className="dash-head">
          <div>
            <span className="dash-eyebrow"><RadioTower size={14} />{t('dashboard.eyebrow')}</span>
            <h1>{t('dashboard.title')}</h1>
            <p>{t('dashboard.subtitle')}</p>
          </div>
          <div className="dash-head__actions">
            <NetworkStatus state="healthy" label={t('status.online')} />
            <button className="language-button" type="button" aria-label={locale === 'fa' ? 'English' : 'فارسی'} onClick={() => setLocale(locale === 'fa' ? 'en' : 'fa')}>
              {t('dashboard.language')}
            </button>
          </div>
        </header>

        <section className="metric-grid" aria-label="Network metrics">
          <MetricCard title={t('dashboard.cloudflare')} value={t('dashboard.connected')} supporting="FRA" accent="network" icon={<RadioTower size={17} />} />
          <MetricCard title={t('dashboard.protocols')} value={t('dashboard.active')} supporting="VLESS · Trojan · XHTTP" accent="protocol" icon={<Waypoints size={17} />} />
          <MetricCard title={t('dashboard.endpoints')} value={t('dashboard.healthy')} supporting="Auto-ranked" accent="health" icon={<Network size={17} />} />
          <MetricCard title={t('dashboard.latency')} value="28 ms" supporting={t('dashboard.bestRoute')} accent="routing" icon={<Activity size={17} />} />
        </section>

        <section className="dashboard-grid">
          <article className="network-map panel-card">
            <div className="panel-title"><span>{t('dashboard.map')}</span><NetworkStatus state="healthy" label="Live" /></div>
            <div className="map-stage" aria-label="Edge network visualization">
              <span className="edge-node edge-node--main">FRA</span>
              <span className="edge-node edge-node--a">AMS</span>
              <span className="edge-node edge-node--b">WAW</span>
              <span className="edge-node edge-node--c">CDG</span>
              <svg viewBox="0 0 600 260" role="img" aria-label="Active edge routes">
                <path d="M300 92 C225 88 175 130 115 175" />
                <path d="M300 92 C345 110 385 135 430 184" />
                <path d="M300 92 C405 76 475 96 520 140" />
              </svg>
            </div>
          </article>
          <article className="health-card panel-card">
            <div className="panel-title"><span>{t('dashboard.health')}</span><strong>94%</strong></div>
            <div className="health-ring"><span>94<small>%</small></span></div>
            <div className="health-list">
              <div><span>VLESS</span><NetworkStatus state="healthy" label={t('status.online')} /></div>
              <div><span>Trojan</span><NetworkStatus state="healthy" label={t('status.online')} /></div>
              <div><span>XHTTP</span><NetworkStatus state="checking" label="Checking" /></div>
            </div>
          </article>
        </section>
      </AppShell>
    </div>
  );
}
