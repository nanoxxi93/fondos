import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target =
    env.VITE_API_BASE_URL ||
    env.VITE_API_TARGET ||
    'https://fondos-purple-fog-9801.fly.dev';

  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/fondos/',
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
