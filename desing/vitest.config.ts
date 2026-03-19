import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

// Vitest is a testing framework that runs alongside Vite.
// It uses the same config as Vite so our path aliases work in tests too.
export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom simulates a browser environment so React components can render in tests
    environment: 'jsdom',
    // This file runs before each test — sets up @testing-library/jest-dom matchers
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
