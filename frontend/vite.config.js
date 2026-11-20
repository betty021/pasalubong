import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Ang /api ay ipinapasa sa Node backend (port 4000)
const proxy = { '/api': 'http://localhost:4000' };
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
