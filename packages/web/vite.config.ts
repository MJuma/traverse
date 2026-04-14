import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
    root: 'src',
    plugins: [react()],
    server: {
        port: 3000,
        strictPort: true,
    },
    build: {
        outDir: '../dist',
    },
});
