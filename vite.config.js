import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import devTelegramLogin from './tools/vite-dev-telegram-login.js'

// base: './' — relative paths, works on GitHub Pages / Vercel / Netlify without changes
export default defineConfig({
  plugins: [react(), devTelegramLogin()],
  base: './',
})
