# Lenz

A Tauri + Vanilla TypeScript markdown viewer with KaTeX support.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Automated Releases (GitHub Actions)

This repo includes a workflow at `.github/workflows/release.yml` that:

- builds the Tauri app on:
  - Linux (`ubuntu-22.04`)
  - Windows (`windows-latest`)
  - macOS (`macos-latest`)
- creates/updates a GitHub Release
- uploads generated bundle artifacts (including AppImage on Linux) to that Release

### Triggering a release

The workflow runs when you push a tag matching `v*.*.*` (for example `v0.1.0`).

You can also run it manually from the GitHub Actions UI using `workflow_dispatch`.

## Notes

- The workflow uses the default `GITHUB_TOKEN` provided by GitHub Actions with `contents: write` permission.
- For tag-triggered builds, use semantic version-like tags such as `v0.1.0`.