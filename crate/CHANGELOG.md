# Changelog

The Rust CLI and MCP server. The VS Code extension has its own
[CHANGELOG](../CHANGELOG.md) and its own version — the two products in
this repository release on their own cadence.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-14

The release that makes this read what you already expected it to read,
and fixes the ways it could quietly read it wrong.

### Changed

- **Every file is read.** Point this at a repository and it opens the
  whole tree. It used to keep only the file types it had a parser for —
  20 of the 88 types a real codebase turns out to hold — so it could not
  open a `.json`, and a design system keeps its tokens in a `.json`.
  `json`, `yaml`, `toml`, `markdown` and `plaintext` are read by name
  now, and anything else is scanned as raw text and reported as format
  `unknown`, so you can always tell which of the two you got. On one
  codebase that took the findings from 56 to 70, and all fourteen new
  ones are real colours in documentation and manifests.

- **Two rules keep prose honest.** Both apply *only* where the syntax is
  unknown — Markdown, plain text, and files this has no parser for.
  Stylesheets and token files are untouched:

  - **A short hex in prose must contain an `a`-`f`.** `#250` in a README
    is an issue reference, not a colour. Measured rather than assumed:
    across 1,988 Markdown files there were 56 bare 3- and 4-digit hex,
    and 50 of them — every all-digit one — were issue or pull-request
    references, while all six containing a letter were real colours.
    `#250` in a token file or a stylesheet is still a colour.
  - **A named colour must be the whole value.** `"paper": "white"` is a
    colour. A sentence about a brand-orange focus ring, a badge URL
    ending `-red)`, and a `class="… text-white …"` are not. Matching a
    keyword anywhere inside a value produced 35 false findings against
    19 real colours.

- **Images and other binary files are passed over quietly** and counted
  in the summary — `3 colors in 40 files, 16 binary files skipped` —
  rather than reported as files that could not be read. Reading every
  file means meeting every PNG, and calling each one a failure would
  have made `--strict` exit 2 on any repository containing an image. **A
  file that looked like text and could not be read is unchanged**: named
  on stderr, carried in the report with a `skipped` diagnostic, and
  still a `--strict` failure.

- **No more `unknown-format` warning line per file.** It said "nothing
  was read", which is no longer true. The `format` field says the same
  thing without a warning for every Python file in the tree.

- **`colors_le_scan` refuses a format name it does not know**, instead
  of quietly scanning the whole tree as raw text, and its schema
  publishes the list of names it accepts.

### Fixed

- **A file containing certain non-English characters could crash the
  scan, or silently lose every colour after that point.** One `İ`, `ẞ`
  or `K` anywhere in an HTML, SVG or XML document was enough: an
  ordinary `<rect fill="#1a2b3c"/>` further down went unreported, and in
  some documents the process aborted outright. Those characters change
  length when lowercased, and the scan was counting on them not to.

- **A colour beside non-English text was missed, and non-Latin digits
  were read as a colour.** `#abcé` is a colour and was not found;
  `rgb(١, 2, 3)` is not one and was reported as `rgb`. A named colour
  followed by a symbol, and a functional call holding an invisible
  space, belong to the same family and are fixed with it. All four now
  answer the way the editor extension answers.

- **A format name with a byte-order mark in front of it resolves
  again.** Three invisible bytes that a Windows editor adds without
  being asked stopped `css` from being recognised, and the document fell
  through to the prose rules above — so the same file could be told it
  had no colours in it.

- **`bgcolor` is read in SVG and XML documents**, and an XML document
  gets the full presentational attribute list: `fill`, `stroke`,
  `stop-color`, `flood-color`, `lighting-color`, `color`, `bgcolor`. A
  `<rect fill="#1a2b3c"/>` read as `xml` returned nothing here while the
  editor extension returned the colour. **If you scan `.svg` or `.xml`
  files, expect findings this release that the last one missed.**

- **`typescriptreact` is a format again.** Every `.tsx` document sent
  under that name came back empty, with no error to say why.

- **Report paths use `/` on every platform**, so a report written on
  Windows diffs against one written anywhere else.

- **An attribute value holding an invisible space is one colour again.**
  `fill="rgb(1, 2, 3)"` written with a byte-order mark inside it counted
  as a colour in the editor and as nothing here.

### Added

- **Six CI jobs, each because something above got through a green
  build.** Two of them are worth naming: `differential` generates
  documents — formats, values, wrappers, characters wider than one byte
  — and requires the `extract_colors` tool to answer identically on this
  server and the editor extension's, which is the check that would have
  caught the `xml` divergence on day one; `fuzz` runs the matchers and
  the comment blankers for a minute per target against deliberately
  awkward input, which is what reproduces the crash above. The other
  four cover hazardous trees, platform differences, a wall-clock budget,
  and whether every format this advertises can actually be opened.
- **Five corpus documents** — `theme.styl`, `app.js`, `compose.yaml`,
  `config.toml` and `release.txt` — so all fourteen formats the tool
  advertises have a document pinning what they read. Five had none, and
  nothing said so.
- **`fixtures/aliases.json`**, the table of format names and extractors
  both frontends are now held to. It was ported by hand twice, which is
  how `typescriptreact` came to work in one and not the other.

**Still not read**, and deliberately: modern colour syntax —
`rgb(255 0 0 / 50%)`, `lab()`, `lch()`, `oklch()`, `color()` — along
with `currentColor` and SCSS/LESS variable references. Those are a
parity change and belong in both frontends at once.

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

[0.2.0]: https://crates.io/crates/colors-le/0.2.0
[0.1.0]: https://crates.io/crates/colors-le/0.1.0
