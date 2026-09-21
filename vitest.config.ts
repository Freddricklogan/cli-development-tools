import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      // src/cli.ts and src/commands/* bind the library to commander and process I/O; they are
      // exercised by the end-to-end test that runs the built binary.
      exclude: []
    }
  }
});
