import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    host: '0.0.0.0',
    port: 4080,
    strictPort: true
  },
  test: {
    include: ['tests/**/*.{test,spec}.{js,ts}']
  }
});
