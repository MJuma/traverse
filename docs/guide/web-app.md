# Web App

The `traverse-web` package is a standalone web SPA that uses `bootstrapExplorer` from `traverse-core`.

## Running

```bash
pnpm serve:web
```

Opens at `http://localhost:3000`.

## How it works

The entire app is 9 lines:

```typescript
import { bootstrapExplorer } from 'traverse-core';

bootstrapExplorer({
    msalClientId: 'your-client-id',
    tenantId: 'your-tenant-id',
    redirectUri: 'http://localhost:3000',
    clusterUrl: 'https://help.kusto.windows.net',
    database: 'Samples',
});
```

`bootstrapExplorer` handles:
1. **StateService hydration** — loads persisted state from IndexedDB
2. **MSAL authentication** — redirect flow (runs before React mounts)
3. **Theme management** — system preference detection, dark/light toggle
4. **Explorer rendering** — FluentProvider + KustoClientContext + Explorer component

## Authentication flow

1. `msalInstance.initialize()` → `handleRedirectPromise()` (processes return from login)
2. If redirect result → authenticated, render app
3. If cached accounts → `acquireTokenSilent()` → render app
4. If no accounts → `loginRedirect()` (page navigates to MS login)
5. Errors render a plain HTML error message (no React)

Mid-session token renewal uses popup (safe because user has already interacted with the page).

## Customization

Pass custom themes or colors:

```typescript
bootstrapExplorer({
    // ... required options
    darkTheme: myDarkTheme,
    lightTheme: myLightTheme,
    colors: myColorConfig,
    clusters: [
        { id: 'prod', name: 'Production', clusterUrl: 'https://mycluster.kusto.windows.net', database: 'MyDB' },
    ],
});
```
