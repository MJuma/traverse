import { defineConfig } from 'vitepress';

export default defineConfig({
    title: 'Traverse',
    description: 'An open-source KQL query editor built with React, Monaco, and Vega-Lite',
    base: '/traverse/',
    head: [
        ['meta', { name: 'theme-color', content: '#6a8799' }],
    ],
    themeConfig: {
        nav: [
            { text: 'Guide', link: '/guide/' },
            { text: 'Components', link: '/guide/components' },
            { text: 'GitHub', link: 'https://github.com/MJuma/traverse' },
        ],
        sidebar: [
            {
                text: 'Getting Started',
                items: [
                    { text: 'Introduction', link: '/guide/' },
                    { text: 'Quick Start', link: '/guide/quick-start' },
                    { text: 'Configuration', link: '/guide/configuration' },
                ],
            },
            {
                text: 'Core Library',
                items: [
                    { text: 'Components', link: '/guide/components' },
                    { text: 'Services', link: '/guide/services' },
                    { text: 'Theming', link: '/guide/theming' },
                ],
            },
            {
                text: 'Apps',
                items: [
                    { text: 'Web App', link: '/guide/web-app' },
                    { text: 'Desktop App', link: '/guide/desktop-app' },
                ],
            },
        ],
        socialLinks: [
            { icon: 'github', link: 'https://github.com/MJuma/traverse' },
        ],
        footer: {
            message: 'Released under the MIT License.',
        },
    },
});
