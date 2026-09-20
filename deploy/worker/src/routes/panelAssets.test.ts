import { describe, expect, it } from 'vitest';
import { handlePanelAssetRoute } from './panelAssets';

describe('embedded panel assets', () => {
  it('serves /admin with locked-down no-store headers and rejects non-GET', () => {
    const response = handlePanelAssetRoute(new Request('https://edge.example/admin'));
    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-type')).toContain('text/html');
    expect(response?.headers.get('cache-control')).toBe('no-store');
    expect(response?.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(response?.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response?.headers.get('x-content-type-options')).toBe('nosniff');
    expect(
      handlePanelAssetRoute(new Request('https://edge.example/admin', { method: 'POST' }))?.status,
    ).toBe(405);
  });

  it('returns immutable asset responses only for generated panel paths', () => {
    const missing = handlePanelAssetRoute(
      new Request('https://edge.example/panel-assets/missing.js'),
    );
    expect(missing?.status).toBe(404);
    expect(missing?.headers.get('cache-control')).toBe('no-store');
    expect(handlePanelAssetRoute(new Request('https://edge.example/elsewhere'))).toBeNull();
  });
});
