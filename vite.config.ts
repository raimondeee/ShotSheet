import { defineConfig } from 'vite'

// GitHub Pages project site: VITE_BASE=/ShotSheet/ npm run build
// Local / file:// / LAN smoke: leave unset → './'
const base = process.env.VITE_BASE || './'

export default defineConfig({
  base,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
