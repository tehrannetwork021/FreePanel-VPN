// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('renders a semantic title, value and supporting text', () => {
    render(<MetricCard title="Latency" value="28 ms" supporting="Best route" accent="network" />);
    expect(screen.getByText('Latency')).toBeVisible();
    expect(screen.getByText('28 ms')).toBeVisible();
    expect(screen.getByText('Best route')).toBeVisible();
  });
});
