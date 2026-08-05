# Changelog

All notable changes to Colors-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-08-04

### Added

- Runtime strings are localized, and this time they render. All 100 of them —
  notifications, status bar, quick-picks and prompts — go through
  `vscode.l10n` and ship as twelve translated bundles in `l10n/`. The v1.x
  line carried manifest catalogues that worked and runtime catalogues that
  never reached the screen: `vscode-nls` was configured without
  `__filename`, so every runtime string fell back to English while the VSIX
  looked correct.
- An integration test covering both localization mechanisms — manifest
  substitution, key parity across all thirteen catalogues, and placeholder
  integrity in every translation. A translation that silently drops `{0}`
  now fails the build instead of shipping a message with the value missing.

- Dependency review on pull requests, failing on a high-severity addition
  before Dependabot's auto-merge can act.

### Fixed

- Input-box validation messages ("Enter a number between 0 and 100", "Enter a
  valid color", "Enter a positive number") were never localized — they are
  returned from a `validateInput` callback rather than assigned to a property,
  so the localization pass had not reached them.
- The "additional filters" and "validation checks" multi-selects matched the
  user's picks by comparing the item label against an English literal. Once
  those labels were localized the comparison could never match, so choosing
  "Exclude duplicates", "Contrast validation" or any of the other five did
  nothing at all in the twelve non-English locales. Labels are now bound once
  and compared by reference.

### Changed

- Test coverage raised from 65.79% to 78.82% of branches (83.02% to 91.03% of
  statements, 88.47% to 96.28% of functions). Eight files sat below one or
  another of the repo's own floors; none do now. The gap was in code reachable
  only by answering a prompt — the filter and validation prompt sequences,
  where every branch past the first depends on the answer before it — and in
  `colorConverter`, whose six output formats and five input parsers had three
  and two covered respectively. `filterColors` is now tested directly rather
  than through the command, so each predicate is checked on its own.
- The `vscode` test mock runs `validateInput` against the value a test
  supplies, as VS Code does. It previously did not, which left every input
  validator uncovered and meant a validator could reject a test's value
  without the test noticing.


- `validate.ts` and `filter.ts` split their quick-pick prompting and their type
  declarations into sibling modules (839 -> 549 and 732 -> 437 lines). Both
  label bugs above lived in the prompting code, buried inside files large
  enough that the mismatch read as normal. The split also stopped the untested
  prompt paths from hiding behind well-tested logic: validate's own coverage
  rose from 79.9% to 87.7% statements once measured separately.
- The prompt functions no longer hand-maintain a mutable mirror of their
  options interface and cast back with `as` on return. A `Draft<T>` mapped type
  derives the mutable shape from the interface, which removed all four type
  assertions in the codebase — including one that widened a quick-pick string
  to a union with no check. `getAvailableFormats()` now returns that union
  rather than `string[]`, so the choice stays typed end to end.
- Colour primitives are defined once. The codebase carried two `rgbToHsl`,
  three `parseColorToHSL`, three `hexToHSL` and three copies of the
  valid-colour predicate, spread across the analyse, filter and validate
  commands — their comments still recorded the copy chain ("reuse logic from
  colorAnalysis.ts", then "Reuse HSL parsing logic from filter.ts"). Every copy
  was verified behaviourally identical first (`rgbToHsl` across all 4,104
  colours of the sampled 8-bit cube) before being replaced by a single shared
  implementation. Nothing had diverged yet; a lightness threshold that
  disagreed between filtering and reporting would have been extremely hard to
  attribute.

- CI gains fleet-wide checks that no single repo can perform: shared config is
  compared across all ten extensions, and every README link is verified —
  including Open VSX links, which are checked against the API because
  open-vsx.org answers HTTP 200 for extensions that do not exist.

## [2.0.1] - 2026-08-04

### Changed

- Marketplace categories re-targeted for discovery. `Other` is dropped
  (65,992 extensions, no discovery value); each extension now sits in
  categories matching how it is actually used.
- Search keywords widened to 30, targeting the terms users actually type
  rather than internal vocabulary.
- Toolchain moved to current: TypeScript 7, vitest 4, Biome 2.5.7,
  @types/node 26. `@types/vscode` is now pinned exactly to the
  `engines.vscode` floor — the caret had let the type surface drift 15
  minors ahead of the version actually supported.
- Runtime dependencies updated across majors where present: csv-parse 7,
  ini 7, js-yaml 5. Extraction output is unchanged, verified against the
  characterization goldens.
- Packaging no longer walks the npm tree (`vsce package --no-dependencies`).
  The bundle is self-contained, so the walk served no purpose and failed
  after any dependency change. Scrape-LE keeps it, since it genuinely
  ships `playwright-core`.
- Documentation claims corrected against the code. Removed: Numbers-LE
  "with statistics", EnvSync-LE "visual diffs", Regex-LE "live feedback",
  String-LE "and validation" — none of those features exist.

### Added

- Rating links in the in-extension help output, for both the VS Code
  Marketplace and Open VSX. Acquisitions exceed listing page views, so most
  users never see the listing's rating control; help is the surface they do
  reach.
- README now carries measured Performance and Testing sections, both
  generated rather than written — from `scripts/benchmark.ts` and from the
  coverage summary. CI fails if the coverage numbers drift from a real run.
- Coverage thresholds enforced at 75 lines / 80 functions / 60 branches /
  75 statements.
- CodeQL scanning, Dependabot with grouped weekly updates, and auto-merge
  limited to patch and minor devDependency bumps that pass CI.

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
