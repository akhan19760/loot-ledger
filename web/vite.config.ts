import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const MOTION = /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/
const MOTION_FEATURES = /[\\/](render[\\/]components[\\/]motion[\\/]|render[\\/]dom[\\/]features-|motion[\\/]features[\\/]|gestures[\\/]|projection[\\/])/

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    rolldownOptions: {
      output: {
        // The big libraries every page needs get chunks of their own: they change far less
        // often than the app, so browsers keep them across deploys (/assets is cached for
        // good, see netlify.toml). Libraries only the dialogs or the deals page use stay in
        // those lazy chunks rather than in a catch-all vendor chunk loaded up front.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            // Motion's core, but not the component features LazyMotion loads later
            // (src/lib/motion-features.ts): grouped here they'd load up front again.
            { name: 'motion', test: (id) => MOTION.test(id) && !MOTION_FEATURES.test(id) },
            { name: 'query', test: /node_modules[\\/]@tanstack[\\/](query-core|react-query)[\\/]/ },
            { name: 'lenis', test: /node_modules[\\/]lenis[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    // The API runs separately in dev (server/, port 3001). It also serves share links, /g/<game>.
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '^/g/': { target: 'http://127.0.0.1:3001', xfwd: true },
    },
  },
})
