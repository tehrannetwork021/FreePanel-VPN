// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App, CLOUDFLARE_TOKEN_TEMPLATE_URL } from './App';

describe('one-click installer', () => {
  it('links to Cloudflare token builder and clears token after install handoff', async () => {
    const install = vi.fn().mockResolvedValue(undefined);
    render(<App install={install} />);
    expect(screen.getByRole('link', { name: /Cloudflare API Token/i })).toHaveAttribute('href', CLOUDFLARE_TOKEN_TEMPLATE_URL);
    const input = screen.getByLabelText('Cloudflare API Token');
    fireEvent.change(input, { target: { value: 'cfut_test_token_12345678901234567890' } });
    fireEvent.click(screen.getByRole('button', { name: /بررسی و نصب/i }));
    await waitFor(() => expect(install).toHaveBeenCalledWith('cfut_test_token_12345678901234567890'));
    expect(input).toHaveValue('');
  });
});
