import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isServe = command === 'serve'
  return {
    plugins: [react(), ...(isServe ? [basicSsl()] : [])],
    base: '/Owlbear5eTools/',
    ...(isServe
      ? {
          server: {
            // HTTPS is provided by the basicSsl() plugin above (it injects a
            // self-signed cert when `server.https` is undefined). `https: true`
            // is intentionally omitted: Vite 7.3's ServerOptions type only
            // accepts an options object, not a boolean.
            port: 5173,
            strictPort: true,
            // OBR fetches the manifest cross-origin from the room page, so the
            // dev server must send CORS headers (GitHub Pages does by default).
            cors: true,
            // Bind IPv4 loopback explicitly: the default `localhost` can resolve
            // to ::1 only, leaving browsers that try 127.0.0.1 with refused
            // connections. Browsers fall back across resolved addresses.
            host: '127.0.0.1',
          },
        }
      : {}),
  }
})
