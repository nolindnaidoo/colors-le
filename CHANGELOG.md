# Changelog

All notable changes to Colors-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file covers the **VS Code extension**. The Rust CLI in `crate/` is a
separate product on its own cadence and keeps its own
[CHANGELOG](crate/CHANGELOG.md).

## [Unreleased]

### Changed

- **Extract works in every document.** JSON, JSONC, YAML, TOML, Markdown
  and plain text are read by name — design tokens live in JSON — and any
  other language id is read as raw text rather than quietly extracted as
  CSS. `metadata.fileType` says which of the two it was.

  Two rules apply only where the syntax is unknown, so stylesheets and
  structured formats are untouched: a 3- or 4-digit hex in prose must
  contain an `a`-`f` (`#250` in a README is an issue reference — 50 of
  56 in a 1,988-file sample), and a named color must be the whole value
  (a paragraph mentioning orange is not a finding).

- **The `extract_colors` MCP tool no longer refuses a call with no
  usable format.** It reads the document as raw text and reports
  `fileType: "unknown"`, matching the Rust server, which never refused
  one.

### Fixed

- **`bgcolor` is read in SVG and XML documents.** It was recognised in
  HTML only, so a `<chart bgcolor="#f0a">` read as `xml` lost its one
  colour. The same change resolves an `xml` divergence with the Rust
  CLI, which ran the HTML extractor there and missed `fill` attributes;
  the format-to-extractor mapping is now pinned for both frontends in
  `crate/fixtures/aliases.json`.

### Added

- The MCP server's alias table is now checked against
  `crate/fixtures/aliases.json`, which the Rust CLI checks itself
  against too. The two tables were ported by hand and had already
  drifted: `typescriptreact` was accepted here and refused there.

- A **Rust CLI and MCP server**, in [`crate/`](crate/README.md), to be
  published to crates.io as `colors-le`. It runs the same extraction over
  a whole tree and, given a palette, fails a build on a colour that is not
  in it — matched by colour rather than by spelling, so a palette in hex
  catches a violation written in `rgb()`.

  Only extraction is ported; convert, analyze and validate are
  interactive and stay here. The extension remains the reference
  implementation and `crate/fixtures/` is the contract.

## [2.2.4] - 2026-08-07

### Changed

- Documentation only — no behaviour change.

  The cross-references now point at each tool's own page on letools.dev rather
  than its VS Code Marketplace listing. The Marketplace listing shows one of
  the four channels a tool ships through; the detail page shows all of them,
  which is what a reader following a link from another tool is looking for.
  Install instructions are untouched, and the rating links now lead with Open
  VSX — where the audience these READMEs reach actually installs from.

- `homepage` in the extension and MCP manifests, and `websiteUrl` in the
  registry entry, resolve to the same detail page.

## [2.2.3] - 2026-08-05

### Changed

- Documentation and packaging metadata only — no behaviour change.

  The MCP server's source now explains its decisions rather than restating its
  code: why MCP's stdio transport is line-delimited and what happens to a client
  if you copy LSP's framing, why a tool failure is a result carrying `isError`
  rather than a JSON-RPC error and what each does to a model's next move, why
  the result cap is measured in context windows rather than milliseconds, and
  why `truncated` matters more than the cap itself.

- The npm package declares `publishConfig.provenance`, so a release published
  from CI carries a Sigstore attestation binding the tarball to the commit and
  workflow that built it. A consumer can verify it with `npm audit signatures`.

- The registry entry names its registry (`registryBaseUrl`) and how to run the
  package (`runtimeHint`), rather than leaving a client to infer both.

- Package metadata points at the author's site, and the npm page links the rest
  of the family, the Rust tools and their crates.

## [2.2.2] - 2026-08-05

### Changed

- Documentation only — no behaviour change.

  The README described a keyboard shortcut and little else. 2.2.1 added an MCP
  server that VS Code registers with agent mode, published it to npm and to the
  official MCP registry, and submitted a Zed extension — and a reader could
  discover none of it from this page. There is now a section for calling the
  tool from an agent, including the JSON config for hosts that use one and a
  one-line check that the server answers before you wire it into anything.

  The privacy section previously spoke only for the extension. It covers the
  server too, which is the part an agent actually runs.

  The registry listing gains a display name, an icon and a link to letools.dev;
  the npm page gains the badges and links it was missing. Every surface now
  points at the others.

## [2.2.1] - 2026-08-05

### Changed

- **VS Code 1.101 is now the minimum.** `engines.vscode` moves from `^1.90.0`
  to `^1.101.0` and `@types/vscode` is pinned exactly to the new floor, per the
  rule that the declared floor and the type surface must match. 1.101 is the
  first stable release carrying `registerMcpServerDefinitionProvider`, which
  the MCP integration needs — declaring the contribution point against an older
  floor would be a claim the code could not honour. Cursor and VSCodium track
  well past this; Cursor 3.6.21 reports 1.105.1.

### Added

- An MCP server, shipped inside the VSIX as `dist/mcp-server.js`. It exposes
  `extract_colors` over stdio, so an agent can pull every color out of a
  stylesheet with its notation and 1-based position.

  It imports the extraction engine and nothing from `vscode` —
  `check:mcp-bundle` fails the build if that stops being true, because the
  server has to run in Zed, in Claude Code, and from `npx`.

- The extension now offers that server to VS Code's agent mode, so installing
  it adds `extract_colors` to the agent's tools alongside the existing commands.
  Nothing is downloaded at runtime: the server is the copy inside the VSIX.
  The registration is skipped on editors that do not implement the API, which
  is not an error — an editor without agent mode is not a broken install.

- The server is on npm as [`colors-le-mcp`](https://www.npmjs.com/package/colors-le-mcp),
  so `npx colors-le-mcp` gives the same tool to Claude Code, Cursor, Windsurf or
  anything else that speaks MCP. It is the same build the VSIX carries, and its
  version is written from this manifest rather than maintained separately.

- A **Zed extension**, under `zed/`. Zed's extension API has no way to read the
  active buffer or register a command, so this extension could never be ported
  there in any language; a context server is the surface that fits. The crate
  is a launcher — it installs `colors-le-mcp` and starts it with Zed's Node —
  so there is no second implementation to keep in agreement with the goldens.

  Two things the boundary fixes rather than the engine, whose behaviour is
  pinned by goldens: `extractColors` reports `success: false` for empty
  content, which is a true result and not a failure, so the envelope's `ok` is
  driven by whether a diagnostic is actually an error; and the engine's warning
  channel is bare strings alongside typed errors, so both are flattened into
  one diagnostics list rather than leaving warnings invisible to a caller.

### Fixed

- The coverage gate could pass against a stale summary. `coverage-readme.js`
  reads `coverage/coverage-summary.json` rather than running coverage, so when
  that file was older than the code both modes lied — the rewrite reproduced
  stale numbers and `--check` then compared the README against the same stale
  file and reported it current. Both modes now refuse a summary older than
  `src/`.

- The manifest placeholder gate only inspected `contributes.commands`, so a
  `%key%` on any other contribution point could ship as literal text. It now
  walks the whole `contributes` tree.

## [2.1.0] - 2026-08-05

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

- A clipboard that could not be written failed the whole extraction. The
  results are already in an editor by the time the copy runs, so an
  unavailable clipboard — a remote or headless session — surfaced as an
  extraction failure for work that had succeeded. It is now a warning.
- Extract, dedupe and sort all reported success over documents they had not
  touched. `vscode.workspace.applyEdit` resolves `false` when an edit is
  rejected — a read-only document, or one that changed underneath the command
  — and all three discarded that value, then announced "Extracted 12 colors",
  "Removed 3 duplicate colors" or "Sorted 12 colors by hue". Extract was worse
  still: when opening the results threw, it showed "Failed to open results"
  and then announced the count anyway, giving a failure and a success for the
  same action. Delivery is now checked before anything is announced, with the
  clipboard copy still counting as delivery since the error text offers it as
  the fallback.
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

- Every `else` block is gone (19 of them), replaced by guard clauses, ordered
  guards and value expressions. The HSL-to-RGB conversion's six-arm hue chain
  is now a lookup table: each sector is the same three values in a different
  order, which the chain restated one channel at a time.
- `commands/extract.ts` held orchestration, output routing and clipboard
  handling together. Routing moved to `commands/output.ts` and the clipboard to
  `utils/clipboard.ts`, leaving the command at 160 lines.
- `commands/validate.ts` held registration, the run, the report and the
  accessibility checks in 485 lines. The report and its checks moved to
  `commands/validateReport.ts`, leaving 262 and 236.

- Test coverage raised from 65.79% to 78.82% of branches (83.02% to 91.03% of
  statements, 88.47% to 96.28% of functions). Eight files sat below one or
  another of the repo's own floors; none do now. The gap was in code reachable
  only by answering a prompt — the filter and validation prompt sequences,
  where every branch past the first depends on the answer before it — and in
  `colorConverter`, whose six output formats and five input parsers had three
  and two covered respectively. `filterColors` is now tested directly rather
  than through the command, so each predicate is checked on its own.
- The `vscode` test mock honours `validateInput`. VS Code will not hand a
  command a value its own validator rejected — the input box stays open until
  the input is valid or the user escapes — but the mock ignored `validateInput`
  entirely and returned whatever the test supplied. That left every validator
  uncovered, and more seriously it let tests drive commands with values the
  real UI could never deliver, so a command could be "proven" to handle input
  that cannot reach it. A rejected value now resolves to `undefined`, which is
  what the caller actually observes, and the rejection is recorded so a test
  can assert the validator fired rather than inferring it from a cancellation.


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
