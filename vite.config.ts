import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

const localSecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export default defineConfig(({command}) => ({
  // GitHub Pages serves project sites from /<repository-name>/.
  // Locally and on root-domain hosts the default remains '/'.
  base: process.env.GITHUB_ACTIONS === 'true'
    ? `/${(process.env.GITHUB_REPOSITORY || '').split('/')[1] || ''}/`
    : '/',
  plugins: [
    react(),
    ...(command === 'build' ? [{
      name: 'taina-production-security-meta',
      transformIndexHtml() {
        return [
          {tag: 'meta', attrs: {'http-equiv': 'Content-Security-Policy', content: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'"}, injectTo: 'head'},
          {tag: 'meta', attrs: {name: 'referrer', content: 'strict-origin-when-cross-origin'}},
        ];
      },
    }] : []),
  ],
  server: {host: '127.0.0.1', headers: localSecurityHeaders},
  preview: {host: '127.0.0.1', headers: localSecurityHeaders},
}));
