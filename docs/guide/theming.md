# Theming

Traverse supports dark and light themes via FluentUI's `FluentProvider` and a built-in theme hook.

## Using bootstrapExplorer

The `bootstrapExplorer` function includes a built-in `useExplorerTheme` hook that:
- Detects system preference (`prefers-color-scheme`)
- Persists user choice to IndexedDB via StateService
- Listens for system preference changes in real-time

```typescript
bootstrapExplorer({
    // ... other options
    darkTheme: myCustomDarkTheme,   // optional, defaults to webDarkTheme
    lightTheme: myCustomLightTheme, // optional, defaults to webLightTheme
});
```

## Embedding with your own theme

When embedding the `Explorer` component directly, you control theming entirely:

```tsx
import { FluentProvider } from '@fluentui/react-components';
import { Explorer } from 'traverse-core';

function App() {
    const { theme, isDark } = useYourOwnThemeHook();

    return (
        <FluentProvider theme={theme}>
            <Explorer isDark={isDark} kustoClient={client} colors={colors} />
        </FluentProvider>
    );
}
```

The `isDark` prop flows through to:
- Monaco editor theme (`vs-dark` / `vs`)
- Vega-Lite chart axis/grid colors
- ResultsTable row highlighting

## ExplorerColorConfig

Colors are injected via the `colors` prop — not hardcoded. This lets you match any design system:

```typescript
const colors: ExplorerColorConfig = {
    semantic: {
        backdrop: 'rgba(0, 0, 0, 0.4)',
        functionBadge: '#4caf50',
        // ... see Configuration page for full list
    },
    chart: {
        palette: ['#6a8799', '#909d63', '#ebc17a', '#bc5653', '#b06698',
                  '#c9dfff', '#7eaac7', '#acbbd0', '#636363', '#d9d9d9'],
    },
};
```
