export type InstallFn = (token: string) => Promise<void>;

export const startLocalInstall: InstallFn = async (token) => {
  const response = await fetch('/api/install', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error('Local installer service is not ready.');
  }
};
