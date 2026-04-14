import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: false,
        environment: 'jsdom',
        include: ['src/**/*.spec.{ts,tsx}'],
        exclude: ['**/node_modules/**', '**/.{idea,git,cache,output,temp}/**'],
        passWithNoTests: false,
        retry: 0,
        typecheck: {
            enabled: true,
            tsconfig: 'tsconfig.spec.json',
        },
        coverage: {
            enabled: true,
            provider: 'v8',
            reporter: ['text', 'cobertura'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                '**/*.d.ts',
                '**/index.ts',
                '**/*.spec.{ts,tsx}',
                '**/*.mock.ts',
            ],
            thresholds: {
                statements: 85,
                branches: 80,
                functions: 85,
                lines: 85,
            },
        },
    },
});
