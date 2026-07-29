# AGENTS.md — Colors-LE

Technical source of truth for this repo. README.md is the user-facing doc; this file is for anyone (human or agent) changing the code.

## What this is

A VS Code extension that extracts colors from the active document (CSS/SCSS/LESS/Stylus, HTML, JS/TS, SVG) into a results editor, with dedupe/sort/convert/filter/analyze/validate post-processing. No network access, no filesystem writes.

## Architecture

```
extension.ts            activate(): createServices() -> registerCommands()
services/serviceFactory createServices(context) -> { telemetry, notifier, statusBar }
commands/               one file per command; extract/dedupe/sort/help take the
                        frozen deps bag; analyze/convert/filter/validate are
                        self-contained (vscode UI + performance.now timing)
extraction/extract.ts   dispatcher: languageId -> FileType -> extractor
extraction/heuristics.ts  THE color patterns/validators: hex + functional
                        regexes, NAMED_COLORS set, comment blanking,
                        declaration-value segmentation, string-literal spans
extraction/position.ts    offset -> {line, column} via newline index (1-based)
extraction/formats/     stylesheet.ts (css/scss/less/stylus), markup.ts
                        (html/svg), javascript.ts — all offset-based
analysis/colorAnalysis  statistics/clusters/patterns for the Analyze command
conversion/colorConverter  convert/validate engines (hex/rgb/hsl, contrast)
ui/                     notifier (window messages, gated by notificationsLevel:
                        all -> everything, important -> warn+error, silent -> error only),
                        statusBar
utils/                  errors (sanitizeErrorMessage), safety (size guards),
                        colorConversion (parse/convert primitives), dedupe,
                        sort, format (formatDuration)
config/config.ts        getConfiguration() snapshot; CONFIG_DEFAULTS table
types.ts                shared types only — no logic
```

Conventions: factory functions + `Object.freeze` (no classes), early returns, dependency bags typed inline at the consumer. Runtime strings are plain English; the 13 `package.nls*.json` catalogues localize **manifest** strings only (VS Code `%key%` substitution — do not add a runtime i18n layer without wiring real bundles).

## Invariants (things that were once broken — keep them true)

- **The bundle must be self-contained.** The VSIX ships `dist/extension.js` only; `scripts/check-bundle.js` (run in `vscode:prepublish` and CI) does a static require scan AND loads the bundle with `vscode` stubbed. esbuild uses `--main-fields=module,main`.
- **`CONFIG_DEFAULTS` must equal package.json defaults.** `config.test.ts` asserts parity over every declared setting; add new settings to both plus the KEY_MAP in the test.
- **Every declared setting must have a consumer.** v1 shipped 19 no-op settings; don't add a setting without wiring it.
- **Extractor behavior is pinned by golden snapshots** (`extraction/characterization.test.ts` + `__fixtures__/`). Any output change must update goldens in the same commit and be listed in the CHANGELOG.
- **nls catalogues stay in key-parity:** all 12 locale files carry exactly the keys of `package.nls.json`.
- **Color heuristics live in one place** (`extraction/heuristics.ts`). Never re-implement color regexes or the named-color list inside a format extractor — v1 had seven divergent copies.
- **Commands pass `document.languageId` to `extractColors`,** never `fileName` — v1 passed fileName and every secondary command silently used the CSS fallback.

## Toolchain

- **Build:** esbuild bundle (`bun run build`, `build:prod` minified). `tsc` is typecheck-only (`noEmit`) and covers test files.
- **Unit tests:** vitest; `vscode` aliased to `src/__mocks__/vscode.ts` (stateful mock with `_reset/_set` helpers, quick-pick/input-box responders). Coverage thresholds enforced: 80 lines / 80 funcs / 75 branches / 80 stmts.
- **Integration tests:** `bun run test:integration` — `@vscode/test-cli` launches a real VS Code (config in `.vscode-test.mjs`, tests compiled via `tsconfig.it.json` to `out-test/`).
- **Lint/format:** Biome (tabs, single quotes). `__fixtures__`/`__snapshots__` are exempt from lint+format+assist — formatting fixtures would corrupt goldens.
- **Packaging:** `bun run package` → `release/*.vsix`. `.vscodeignore` is an allow-list; the VSIX is ~21 files.

## Release

1. Bump `version` in package.json, add a CHANGELOG entry.
2. CI green on all 3 OSes (includes packaging + integration tests).
   Locally, `bun run package && bun run test:e2e-vsix` proves the actual
   VSIX installs and works in a clean VS Code profile.
3. `Release` workflow (manual dispatch) publishes to the VS Code Marketplace (`VSCE_PAT`) and Open VSX (`OVSX_PAT`) — Open VSX is what Cursor/VSCodium users install from. Locally: `bun run package` then `vsce publish` / `ovsx publish`.

## Known limitations (documented, not bugs)

- Modern space-separated color syntax (`rgb(255 0 0 / 50%)`) and `lab()`/`lch()`/`oklch()`/`color()` are not extracted.
- JS/TS extraction is string-literal-scoped: any hex/functional match inside a string extracts, including URL fragments (`'https://x/#ff0000'`). Identifiers and comments never match.
- Stylus named colors are only recognized after `:` or `=`; omitted-colon property lines yield hex/functional literals only.
- Unknown language ids fall back to CSS-style extraction (hex/functional literals anywhere) rather than erroring.
