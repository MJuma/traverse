# Services

## createKustoClient

Factory function that creates a `KustoClient` instance for executing KQL queries.

```typescript
const client = createKustoClient({
    defaultTarget: { clusterUrl: 'https://help.kusto.windows.net', database: 'Samples' },
    getToken: async (clusterUrl) => fetchToken(clusterUrl),
    stateService,
});
```

Features:
- **Query caching** — Results cached in StateService with configurable TTL
- **In-flight dedup** — Identical concurrent queries share a single network request
- **Concurrency limiting** — Max 8 concurrent queries with priority queue (high/normal)
- **Retry with backoff** — Automatic retry on 429 (throttled) with exponential backoff
- **Multi-cluster** — Pass `target` parameter to query any cluster

## StateService

Two-tier state management: in-memory Map (all reads, ~0.001ms) + IndexedDB (async persistence).

```typescript
import { stateService } from 'traverse-core';

// Read (synchronous, from memory)
const theme = stateService.get('config', 'theme');

// Write (memory immediate, IndexedDB async)
stateService.set('config', 'theme', 'dark');

// Subscribe (for React useSyncExternalStore)
const unsubscribe = stateService.subscribe('config', 'theme', callback);
```

Stores: `config`, `queryCache`, `explorerCache`, `explorerConnections`.

## Schema Service

Live Kusto schema loading with caching per cluster+database.

```typescript
import { loadSchema, getSchema, listDatabases } from 'traverse-core';

await loadSchema(client, { clusterUrl, database });
const tables = getSchema({ clusterUrl, database });
const dbs = await listDatabases(client, clusterUrl);
```

## Query History

IndexedDB-backed query history with full result recall.

```typescript
import { getHistory, saveHistoryEntry, recallResult } from 'traverse-core';

const history = await getHistory();
const cachedResult = await recallResult(queryText);
```

## useKustoQuery Hook

React hook for executing KQL queries with loading/error/data state.

```typescript
const { data, loading, error, refresh } = useKustoQuery('StormEvents | take 10', { client });
```
