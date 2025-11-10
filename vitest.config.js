import { defineConfig } from 'vitest/config'

// Basic Vitest config for a React + Vite project. Uses jsdom so DOM testing
// is available in unit tests. A small setup file is used to load jest-dom.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: 'src/setupTests.js',
    coverage: {
      reporter: ['text']
    }
  }
})
