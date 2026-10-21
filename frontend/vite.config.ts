import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Serves the Netlify OTP functions in `vite dev` so http://localhost:5173 works; the key is read from .env on the server only.
function otpFunctionsDev(env: Record<string, string>): Plugin {
  const routes: Record<string, string> = { '/api/auth/otp/request': 'requestOtp', '/api/auth/login/user': 'verifyOtp' };
  return {
    name: 'otp-functions-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handler = routes[(req.url || '').split('?')[0]];
        if (!handler || req.method !== 'POST') return next();
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        // @ts-ignore plain .mjs module without type declarations
        const lib: Record<string, (r: Request, o: { env: Record<string, string> }) => Promise<Response>> = await import('./netlify/functions/lib/otp.mjs');
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
        const response = await lib[handler](new Request('http://localhost' + req.url, { method: 'POST', headers, body: Buffer.concat(chunks) }), { env });
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(await response.text());
      });
    }
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), otpFunctionsDev(loadEnv(mode, process.cwd(), ''))],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }
  }
}));
