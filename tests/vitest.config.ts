import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['api/**/*.test.ts'],
    setupFiles: ['./setup.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    // 限制并发，避免触发 Cloudflare 速率限制
    maxConcurrency: 3,
    // 串行执行测试文件
    fileParallelism: false,
    // 单线程运行
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
