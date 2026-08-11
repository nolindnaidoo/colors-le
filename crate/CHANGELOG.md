# Changelog

The Rust CLI and MCP server. The VS Code extension has its own
[CHANGELOG](../CHANGELOG.md) and its own version — the two products in
this repository release on their own cadence.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-11

First release. The extension's extraction engine, ported and pinned
against a shared corpus, over a tree instead of a stylesheet.

### Added

- **Extraction for all nine formats** the extension reads — CSS, SCSS,
  LESS, Stylus, HTML, XML, SVG, JavaScript and TypeScript — reproducing
  its colours, notations and positions for every case in `fixtures/`.
  That includes the parts worth stating: a multiline `rgb()` found and
  normalised to single spaces, a five-digit hex rejected, comments
  blanked in four syntaxes, and a named colour that counts only where a
  value is expected.
- **`--palette`**, the one addition. A list of approved colours — one per
  line, a JSON array, or a flat JSON object's values — and anything else
  becomes a finding. Comparison is **by colour rather than by text**, so
  a palette in hex catches a violation in `rgb()`; alpha is part of the
  identity; and a named colour is only equal to itself, because `white`
  and `#ffffff` are the same pixel and not the same decision.
- **The CLI**: JSON reports on stdout one per line, a human summary on
  stderr, and exit codes — 0 clean, 1 none found or a colour outside the
  palette, 2 the question was malformed. `--dedupe`, `--values`,
  `--format`, `--stdin`, `--hidden`, `--no-ignore`.
- **The MCP server** (`colors-le mcp`) with two tools: `extract_colors`,
  shared byte-for-byte with the npm server, and `colors_le_scan`.

### The shape of it

**Half the extension, on purpose.** Convert, analyze and validate are
interactive quick-picks and stay in the editor — which is also what the
extension's own MCP tool says by offering extraction alone. The
extension's `validate` already computes WCAG contrast ratios; that
capability is real and deliberately left where it is until a contrast
auditor is designed as its own thing.

**An unknown format is a refusal, not a fallback**, unlike string-le and
numbers-le. A colour only means something where a colour can appear, and
a raw scan of a README would report every `#anchor` as a three-digit hex.

[0.1.0]: https://github.com/nolindnaidoo/colors-le/releases/tag/crate-v0.1.0

### Fixed

- **A leading byte-order mark is no longer part of the document.** Three
  invisible bytes, added by Notepad, Excel and a PowerShell redirect, and
  stripped by VS Code before the extension ever sees a file — so the two
  frontends read the same file differently. It shifted every column on
  line one, and before a `{` it made a structured parser reject the whole
  document, which is indistinguishable from a file with no colours in it.

- **A file that cannot be read no longer fails the run.** Every
  repository has a PNG, a zip and something the runner lacks permission
  for. Exiting 2 on those made the tool unusable in CI, which is the one
  place it is most worth running. Such a file is now named on stderr and
  carried in the report with a `skipped` diagnostic, and the exit code
  reflects what was found. `--strict` restores the old behaviour for a
  pipeline that wants zero tolerance.

- **A file that is not text is named rather than dropped.** It used to
  vanish from the report entirely, which reads to whoever ran it as
  "that file was clean".
