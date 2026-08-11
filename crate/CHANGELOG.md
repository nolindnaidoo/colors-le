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
