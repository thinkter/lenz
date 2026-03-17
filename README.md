# Lenz

A desktop markdown viewer built with Tauri and TypeScript.

It is designed for opening a markdown file from the terminal, rendering it in a native window, and staying out of the way. KaTeX is supported, file changes are watched live, and the app now detaches from the terminal when launched so the shell stays usable.

## Features

- Open a markdown file directly from the command line with `lenz <file.md>`.
- Live-reload the view when the file changes on disk.
- Render math with KaTeX.
- Scroll with standard input devices or Vim-style `j` / `k`.
- Zoom the document with `Ctrl/Cmd +` and `Ctrl/Cmd -`.
- Persist zoom level across launches using the platform app config directory.

## Usage

```bash
lenz notes.md
```

If the file path is relative, Lenz will try a few sensible locations, including the original working directory and the executable directory, which helps when it is launched from packaged builds such as AppImage.

## Development

### Requirements

- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/tools/install)
- Tauri system dependencies for your platform

### Run in development

```bash
bun install
bun run dev:app
```

Useful fixture scripts:

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
