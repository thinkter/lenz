# Lenz

Native desktop Markdown preview from your terminal (Tauri + TypeScript).
<img width="1920" height="1200" alt="image" src="https://github.com/user-attachments/assets/26003195-c0f5-4ffb-a5e1-7a3318e1f6c6" />



## Features
- Live reload
- KaTeX math via `$$ ... $$`
- Full CommonMark support thanks to markdown-it
- Vim Motions like `j`, `k`, `gg`, `G`
- Zoom: `Ctrl/Cmd +` and `Ctrl/Cmd -`
- Press `o` for the file picker

## Install

- Download the latest build from GitHub Releases (Windows installer, macOS `.app`, Linux AppImage/bundles): [`releases/latest`](../../releases/latest)
- Or build from source (see Development).

## Usage

```bash
lenz notes.md
```

## Development

### Requirements

- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/tools/install)
- Tauri system dependencies for your platform (see Tauri docs)

### Run in development

```bash
bun install
bun run dev:app
```

Open an arbitrary file in dev:

```bash
bun tauri dev -- -- path/to/file.md
```

Fixtures:

```bash
bun run dev:app:short
bun run dev:app:long
bun run dev:app:math
bun run dev:app:readme
```

### Build locally

```bash
bun run build
cargo check --manifest-path src-tauri/Cargo.toml
bun run tauri build
```
