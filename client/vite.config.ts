import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Binds to all network interfaces instead of just localhost, so other
    // devices on the same LAN can reach this dev server directly.
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
    // Vite's dev server otherwise rejects any request whose Host header
    // isn't localhost (a DNS-rebinding defense) — which is exactly what
    // breaks access through a Cloudflare Tunnel or any other domain/reverse
    // proxy pointed at this dev server. Disabling it is an accepted
    // dev-only tradeoff here (see README's "Known limitations"); a real
    // production build wouldn't run through Vite's dev server at all.
    allowedHosts: true,
  },
})
