import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
    root: 'src',
    plugins: [react()],
    // Tauri expects a fixed port during dev
    server: {
        port: 5175,
        strictPort: true,
        // Allow connections from other machines (for remote dev from Mac)
        host: '0.0.0.0',
    },
    // Tauri uses env vars to know when building for desktop
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
        outDir: '../dist',
        // Tauri uses Chromium on Windows and WebKit on macOS/Linux
        target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari15',
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_DEBUG,
    },
});
