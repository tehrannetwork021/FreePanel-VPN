import { spawnSync } from 'node:child_process';

// Wrangler starts workerd children. Stop only this test's process tree before deleting its state.
export async function stopTestProcess(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
      timeout: 10000,
    });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already stopped */
    }
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
  if (child.exitCode === null && child.signalCode === null) {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}
