import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' — relative paths, works on GitHub Pages / Vercel / Netlify without changes
export default defineConfig({
  plugins: [react()],
  base: './',
})
