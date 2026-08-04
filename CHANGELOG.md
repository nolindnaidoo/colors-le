# Changelog

All notable changes to Colors-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-08-03

### Changed

- Marketplace categories re-targeted for discovery. `Other` is dropped
  (65,992 extensions, no discovery value); each extension now sits in
  categories matching how it is actually used.

### Added

- Rating links in the in-extension help output, for both the VS Code
  Marketplace and Open VSX. Acquisitions exceed listing page views, so most
  users never see the listing's rating control; help is the surface they do
  reach.

## [2.0.0] - 2026-07-29

Full rehabilitation release. The headline: **v1.x VSIXes built from this
repo could not activate** — the build had no bundler while the package
excluded `node_modules`, so the extension crashed on load with
`Cannot find module 'vscode-nls'`. 2.0.0 ships a self-contained esbuild
bundle, verified by a packaging gate and a real extension-host
integration suite on every CI run.

### Fixed

- **Packaging**: `dist/extension.js` is now a single self-contained
  bundle (VSIX: 62 files → 21). A bundle gate (static require scan +
  loading the bundle with `vscode` stubbed) blocks any regression.
- **Extract truncated everything past the 8th color**: `maxColors` was
  wired to `safety.manyDocumentsThreshold` (default 8). Extraction is
  now uncapped; the large-output safety warning still applies.
- **Analyze/Convert/Filter/Validate never matched the file type**: all
  four passed the file *path* where a language id was expected, so every
  file was parsed by the CSS fallback — SCSS variables, JS string
  colors, and SVG attribute colors were invisible to them.
- **Whole-document edits**: `Range(0,0,lineCount,0)` stopped at the
  start of the last line, silently dropping the final line of any
  document not ending in a newline (extract-in-place, dedupe, sort).
- **Config**: non-numeric setting overrides no longer produce `NaN`
  thresholds; non-boolean values no longer coerce by truthiness;
  `openResultsSideBySide` code fallback (false) now provably matches
  the manifest default (true), asserted by a parity test over every
  declared setting; the undeclared `notificationLevel` fallback read is
  gone.
- **Status bar** reacts to `statusBar.enabled` changes without reload;
  **telemetry** reacts to `telemetryEnabled` the same way.
- **Context menu**: the `resourceExtname in .css || …` when-clause never
  matched ('in' tests context-key lists, not literals) — the menu item
  had never appeared. Replaced with an `editorLangId` regex that also
  covers jsx/tsx.
- **jsx/tsx**: `javascriptreact`/`typescriptreact` language ids now
  dispatch to the JS extractor (previously fell through to the CSS
  fallback).
- **Runtime localization**: `vscode-nls` was wired without bundles, so
  direct call sites always showed dev-mode English while the Localizer
  wrapper showed raw keys like `runtime.error.no-active-editor`. All
  runtime strings are now plain English; the 13 nls catalogues keep
  localizing the manifest (commands/settings UI) via `%key%`
  substitution, now in exact key-parity.

### Changed — extraction output

- **One shared heuristics module** replaces seven divergent per-format
  extractors; all formats match whole content instead of per-line:
  - Multiline functional colors (`rgb(` spanning lines) now extract
    everywhere; reported values normalize internal whitespace.
  - Real 1-based line/column positions in every format — SCSS/LESS/
    Stylus previously reported 0-based columns and synthetic contexts
    (`"SCSS variable"`); context is now the real source line.
  - Comments: block comments spanning lines are respected everywhere
    (v1 leaked colors from comment lines without the opening `/*`);
    `//` line comments respected in SCSS/LESS/Stylus and JS/TS; comment
    markers inside strings no longer start comments.
  - Named colors are uniform: declaration values in the CSS family
    (plain CSS previously extracted none), style contexts and color
    attributes in HTML/SVG, whole-string literals in JS/TS.
    `rebeccapurple` joins the keyword set.
  - 4-digit hex (`#rgba`) is now recognized everywhere.
  - JS/TS: the style-context guess is gone — colors in ANY string or
    template literal extract (theme objects previously yielded zero
    colors). Documented tradeoff: a hex inside a URL string matches.
  - HTML/SVG: colors are recognized only in style attributes, `<style>`
    blocks, and color attributes (`bgcolor`/`color`; `fill`/`stroke`/
    `stop-color`/`flood-color`/`lighting-color`) — bare hex elsewhere
    (`href="#section"`, data-attributes) no longer extracts.
  - Output is document-ordered and deduped by position; duplicate
    values each keep their own real position.
- Reports from Analyze/Convert/Filter/Validate no longer print a
  "Memory Usage" line (it showed current process heap, not the cost of
  the operation).

### Added

- `dedupeEnabled` and `notificationsLevel` are now actually wired:
  extraction can auto-dedupe its output, and `all`/`important`/`silent`
  genuinely govern notifications (silent = errors only).
- Golden characterization snapshots pin extractor output per format;
  CI (3 OSes) runs lint → typecheck → coverage (thresholds
  80/80/75/80) → build → bundle gate → package → real extension-host
  integration tests; a manual release workflow publishes to the
  VS Code Marketplace and Open VSX.

### Removed

- 19 settings that were never read by any code path (`analysis.*`,
  `performance.*`, `keyboard.*`, `presets.*`, `csv.streamingEnabled`,
  `postProcess.openInNewFile`, `safety.manyDocumentsThreshold`,
  `showParseErrors`, `sortEnabled`). 10 real settings remain.
- The CSV-streaming toggle command — there is no CSV feature in
  colors-le; it was template residue.
- `vscode-nls` (see Fixed), the never-running performance monitor, the
  enhanced-error framework (categories/severity/recovery options that
  fed console.log), and the fabricated docs
  (`ENTERPRISE_QUALITY.md`, generated `docs/PERFORMANCE.md`, invented
  test/coverage claims).

## Pre-2.0 releases

Versions 1.0.0–1.8.1 predate the rehabilitation. Their changelog
entries claimed features and quality bars that did not hold up against
the code (see 2.0.0 Fixed) and have been removed rather than restated.
Tags remain in git history.
