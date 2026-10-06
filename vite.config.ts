import { defineConfig } from 'vitest/config';
import { execSync } from 'node:child_process';
import pkg from './package.json' with { type: 'json' };

// Hash commit hiện tại, hiện ở màn Cài đặt để biết người chơi đang ở bản nào (chống nhầm bản cache cũ).
function gitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // Đường dẫn tương đối: chạy được trên GitHub Pages (thư mục con) và trong iframe của Portal BTC.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_HASH__: JSON.stringify(gitHash()),
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0, // font giữ file riêng có hash, không nhét base64 vào JS
    sourcemap: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
