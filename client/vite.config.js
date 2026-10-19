import { defineConfig } from 'vite';

export default defineConfig({ server: { port: 5175, strictPort: true, proxy: { '/api': 'http://localhost:4000' } } });
