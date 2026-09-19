// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NetworkStatus } from './NetworkStatus';

describe('NetworkStatus', () => {
  it('does not rely on color alone for healthy state', () => {
    render(<NetworkStatus state="healthy" label="Online" />);
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByLabelText('healthy')).toBeInTheDocument();
  });
});
