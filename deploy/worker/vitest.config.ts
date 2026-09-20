import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'tehran-network-sql-text',
      enforce: 'pre',
      load(id) {
        if (!id.endsWith('.sql')) return null;
        return `export default ${JSON.stringify(readFileSync(id, 'utf8'))};`;
      },
    },
  ],
});
