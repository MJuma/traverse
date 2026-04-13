# Desktop App

The `traverse-desktop` package is a Tauri 2 native desktop wrapper around the same Explorer UI.

## Prerequisites

- [Rust](https://rustup.rs/) toolchain
- Tauri CLI: `cargo install tauri-cli`
- **Linux**: `webkit2gtk4.1-devel` (Ubuntu/Debian — not available on Azure Linux)
- **macOS/Windows**: Works out of the box

## Running

```bash
pnpm serve:desktop
```

Opens at `http://localhost:5175` with Tauri wrapping.

## Structure

```
packages/desktop/
├── src/              ← React frontend (same as web)
│   ├── main.tsx      ← bootstrapExplorer() call
│   └── index.html
├── src-tauri/        ← Rust backend (if present)
│   ├── Cargo.toml
│   ├── src/main.rs
│   └── tauri.conf.json
├── vite.config.ts
└── package.json
```

## Differences from Web

| | Web | Desktop |
|---|---|---|
| Port | 3000 | 5175 |
| Auth redirect | `http://localhost:3000` | `http://localhost:5175` |
| Native features | — | File system, system tray, window management |
| Distribution | Static hosting | Installer (`.msi`, `.dmg`, `.deb`) |

## Building for production

```bash
cd packages/desktop
cargo tauri build
```

This produces platform-specific installers in `src-tauri/target/release/bundle/`.

## CI considerations

Tauri builds require platform-specific agents:
- **Linux**: x64 + arm64 (Ubuntu, not Alpine/Azure Linux)
- **macOS**: Universal binary (x64 + arm64)
- **Windows**: x64 + arm64

Cross-compilation of signed macOS apps from Linux is not supported.
