import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const configuredHosts = loadEnv(mode, process.cwd(), 'VITE_').VITE_ALLOWED_HOSTS
    ?.split(',')
    .map(host => host.trim())
    .filter(Boolean);

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      ...(configuredHosts?.length ? { allowedHosts: configuredHosts } : {}),
      proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }
    }
  };
});
