# Configuration

## BootstrapExplorerOptions

When using `bootstrapExplorer()`, all configuration is passed via the options object:

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `msalClientId` | `string` | ✅ | — | Azure AD app registration client ID |
| `tenantId` | `string` | ✅ | — | Azure AD tenant ID |
| `redirectUri` | `string` | ✅ | — | MSAL redirect URI (e.g. `http://localhost:3000`) |
| `clusterUrl` | `string` | ✅ | — | Default Kusto cluster URL |
| `database` | `string` | ✅ | — | Default database name |
| `darkTheme` | `Theme` | ❌ | `webDarkTheme` | FluentUI theme for dark mode |
| `lightTheme` | `Theme` | ❌ | `webLightTheme` | FluentUI theme for light mode |
| `clusters` | `WellKnownCluster[]` | ❌ | Auto-generated from clusterUrl | Pre-seeded cluster list |
| `colors` | `ExplorerColorConfig` | ❌ | Default palette | Explorer color configuration |

## ExplorerProps

When embedding the `Explorer` component directly:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isDark` | `boolean` | ❌ | Whether to use dark theme for Monaco and charts |
| `kustoClient` | `KustoClient` | ✅ | Client created via `createKustoClient()` |
| `colors` | `ExplorerColorConfig` | ✅ | Semantic colors and chart palette |
| `clusters` | `WellKnownCluster[]` | ❌ | Pre-seeded cluster connections |
| `className` | `string` | ❌ | CSS class override for the root element |

## ExplorerColorConfig

```typescript
interface ExplorerColorConfig {
    semantic: {
        backdrop: string;           // Modal backdrop overlay
        functionBadge: string;      // Function type badge color
        highlightHoverBg: string;   // Hover highlight background
        lookupBadge: string;        // Lookup table badge color
        materializedViewBadge: string; // Materialized view badge
        scrollThumb: string;        // Scrollbar thumb color
        scrollThumbHover: string;   // Scrollbar thumb hover
        selectionBg: string;        // Selection background
        selectionSubtle: string;    // Subtle selection background
        shadowLight: string;        // Light shadow
        shadowMedium: string;       // Medium shadow
    };
    chart: {
        palette: string[];          // Chart color palette (10 colors recommended)
    };
}
```

## KustoClientConfig

```typescript
interface KustoClientConfig {
    defaultTarget: { clusterUrl: string; database: string };
    getToken: (clusterUrl: string) => Promise<string>;
    stateService: KustoStateService;
}
```

The `stateService` parameter accepts any object implementing the `KustoStateService` interface — the built-in `stateService` singleton from traverse-core works out of the box.
