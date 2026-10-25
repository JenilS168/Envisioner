import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Run in Node — no browser/JSDOM needed for pure geometry + Three.js tests.
    // GLTFExporter's Blob/URL download path is NOT exercised in the test suite
    // (we test the ArrayBuffer directly), so no DOM stub is required.
    environment: 'node',
    include: ['src/__tests__/**/*.test.js'],
  },
})
