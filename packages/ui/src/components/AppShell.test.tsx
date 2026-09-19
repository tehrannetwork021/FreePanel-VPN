// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders rtl without clipping long content container', () => {
    render(
      <AppShell dir="rtl" brand="Tehran Network" navigation={[]}>
        <div data-testid="content">متن فارسی بسیار طولانی برای بررسی چیدمان واکنش‌گرا</div>
      </AppShell>,
    );
    expect(screen.getByTestId('app-shell')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByTestId('content')).toBeVisible();
  });
});
