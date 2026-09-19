import type { InstallerEnv } from './env';
import { handleInstallerRequest } from './router';

export default {
  fetch(request: Request, env: InstallerEnv): Promise<Response> {
    return handleInstallerRequest(request, env);
  },
};
