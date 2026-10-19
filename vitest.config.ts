import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The MCP e2e test spawns a server process via tsx, which needs headroom.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
