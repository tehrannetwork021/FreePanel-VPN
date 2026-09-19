import { Activity, AlertTriangle, CircleCheck, CircleX } from 'lucide-react';
import type { ReactNode } from 'react';

export type NetworkState = 'healthy' | 'warning' | 'offline' | 'checking';

type Props = {
  state: NetworkState;
  label: string;
};

const icons: Record<NetworkState, ReactNode> = {
  healthy: <CircleCheck aria-hidden="true" size={16} />,
  warning: <AlertTriangle aria-hidden="true" size={16} />,
  offline: <CircleX aria-hidden="true" size={16} />,
  checking: <Activity aria-hidden="true" size={16} />,
};

export function NetworkStatus({ state, label }: Props) {
  return (
    <span className={`tn-status tn-status--${state}`} aria-label={state}>
      {icons[state]}
      <span>{label}</span>
    </span>
  );
}
