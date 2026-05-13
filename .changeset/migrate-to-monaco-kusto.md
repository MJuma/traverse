---
"@mhjuma/traverse": minor
---

Replace the hand-rolled KQL Monarch tokenizer and regex completion provider
with the official `@kusto/monaco-kusto` language plugin (Kusto.Language engine
running in a Web Worker). This gives semantic highlighting, full IntelliSense
(let-bindings, joins, function defs, plugin functions), hover, signature help,
diagnostics, and formatting.

Breaking changes for hosts:

- `monaco-editor` and `@monaco-editor/react` are now peer dependencies. Hosts
  must install them directly; `monaco-editor` must be pinned to `0.52.x` for
  compatibility with `@kusto/monaco-kusto@14.x`.
- A new `configureTraverseMonacoWorkers({ getEditorWorker, getKustoWorker })`
  must be called once before mounting `<Explorer>` to wire up the Monaco and
  Kusto language workers. See the Quick Start guide for the Vite recipe and
  notes on Webpack/Next.js hosts.

Bundle impact: the Kusto language service ships ~6 MB of compiled engine code
in a dedicated worker chunk, loaded lazily only when an editor mounts.

Perceived-perf optimizations: the kusto language registers (Monarch tokens
provider + themes) on first `<Explorer>` render via an internal
`preloadKustoLanguage()` call, so first paint already shows colored keywords
and strings. Hosts can additionally pre-warm the kusto worker during
`requestIdleCallback` (see Quick Start) to overlap Bridge.NET evaluation with
auth/React init — semantic-token colors then arrive without a visible delay.
