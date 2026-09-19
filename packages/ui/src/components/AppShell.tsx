import { Languages, RadioTower } from 'lucide-react';
import type { PropsWithChildren, ReactNode } from 'react';

export type NavItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  active?: boolean;
};

type Props = PropsWithChildren<{
  dir: 'rtl' | 'ltr';
  brand: string;
  navigation: NavItem[];
  localeLabel?: string;
}>;

export function AppShell({ dir, brand, navigation, localeLabel = 'FA / EN', children }: Props) {
  return (
    <div className="tn-shell" data-testid="app-shell" dir={dir}>
      <aside className="tn-shell__rail">
        <div className="tn-brand">
          <span className="tn-brand__mark"><RadioTower size={22} /></span>
          <span className="tn-brand__text"><strong>{brand}</strong><small>Edge Platform</small></span>
        </div>
        <nav className="tn-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <button className={item.active ? 'tn-nav__item is-active' : 'tn-nav__item'} key={item.id} type="button">
              {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="tn-shell__locale"><Languages size={17} /><span>{localeLabel}</span></div>
      </aside>
      <main className="tn-shell__main">
        <div className="tn-shell__aurora" aria-hidden="true" />
        <div className="tn-shell__content">{children}</div>
      </main>
    </div>
  );
}
