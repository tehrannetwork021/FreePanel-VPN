// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('dashboard preview', () => {
  it('starts Persian RTL and switches to English LTR', () => {
    render(<App />);
    expect(screen.getByTestId('dashboard')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByText('نمای کلی')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByTestId('dashboard')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('Overview')).toBeVisible();
  });
});
