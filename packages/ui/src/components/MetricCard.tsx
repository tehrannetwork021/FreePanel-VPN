import type { ReactNode } from 'react';

export type MetricAccent = 'network' | 'protocol' | 'routing' | 'health' | 'alert';

type Props = {
  title: string;
  value: string;
  supporting?: string;
  accent?: MetricAccent;
  icon?: ReactNode;
};

export function MetricCard({ title, value, supporting, accent = 'network', icon }: Props) {
  return (
    <article className={`tn-metric tn-metric--${accent}`}>
      <header className="tn-metric__header">
        <span>{title}</span>
        {icon ? <span className="tn-metric__icon">{icon}</span> : null}
      </header>
      <strong className="tn-metric__value">{value}</strong>
      {supporting ? <p className="tn-metric__supporting">{supporting}</p> : null}
      <span className="tn-metric__glow" aria-hidden="true" />
    </article>
  );
}
