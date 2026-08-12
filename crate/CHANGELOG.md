# Changelog

The Rust CLI and MCP server. The VS Code extension has its own
[CHANGELOG](../CHANGELOG.md) and its own version — the two products in
this repository release on their own cadence.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Every file is read.** The walk had a format filter and opened 20 of
  the 88 file types found in real repositories — which meant it could
  not open a `.json`, where a design system keeps its tokens. It opens
  everything now: `json`, `yaml`, `toml`, `markdown` and `plaintext`
  join the nine named formats, and anything else is scanned as raw text
  and reported as format `unknown`. On one real repository this took the
  findings from 56 to 70, and all fourteen new ones are real colours in
  documentation and manifests.

  Two rules make that safe, and both apply **only** where the syntax is
  unknown — stylesheets and structured formats are untouched:

  - **A short hex in prose must contain an `a`-`f`.** Across 1,988 real
    Markdown files, 50 of the 56 bare 3/4-digit hex were issue or PR
    references (`#250`, `#3050`) and the six with a letter in them were
    all real colours. `#250` in a token file or a stylesheet is still a
    colour.
  - **A named colour must be the whole value.** Matching any keyword
    inside a value segment produced 35 false findings against 19 real
    colours on two real repositories.

- **A binary file is passed over silently and counted**, rather than
  reported as a file that could not be read. A NUL byte in the first
  8 KB is the test — ripgrep's own — and such a file produces no report
  line and cannot reach the exit code; the stderr summary carries
  `16 binary files skipped`, and `colors_le_scan` carries
  `data.binarySkipped`. Reading every file put 14 PNGs, an `.ico` and a
  `.jpg` in front of one repository's reader, which would have made
  `--strict` exit 2 on any repository containing an image. **A file that
  looked like text and could not be read is unchanged**: named,
  diagnosed, and still a `--strict` failure. That distinction is the
  point.

- **The `unknown-format` diagnostic is gone.** It said "nothing was
  read", which is no longer true; the `format` field carries the same
  information without a warning line per file.

- **`colors_le_scan` refuses a format it cannot name**, instead of
  quietly scanning the whole tree as raw text. Its schema now publishes
  the format enum, and both tool descriptions were rewritten — they
  described a different product's formats.

### Fixed

- **A document holding `İ` or `ẞ` no longer aborts the process.** The
  markup extractor took its attribute and `<style>` offsets from a
  `to_lowercase` copy of the document and applied them to the original.
  That is only safe while lowercasing preserves length, and it does not:
  `İ` becomes two characters, `K` (the Kelvin sign) becomes one byte
  from three. Every span after such a character slid, which lost the
  colours in an ordinary `<rect fill="…"/>` — and, when the slide landed
  inside a character, panicked. ASCII folding now, which is all a tag or
  attribute name ever needs. Found by the new `differential` job and
  reproduced by `fuzz` in under two thousand documents.

- **A format name wearing a byte-order mark resolves again.** U+FEFF is
  whitespace to JavaScript's `trim` and not to Rust's, so
  `format: "\u{feff}css"` — three invisible bytes a Windows editor adds
  without being asked — resolved to `css` on the extension and fell
  through to the raw scan here. In this crate that is not cosmetic: the
  raw scan is where the two prose rules live, so the two servers
  disagreed about whether `#250` is a colour. `extract/js.rs` now holds
  JavaScript's whitespace set once, in both the forms this needs, and
  every trim on the shared path goes through it.

- **The matchers use the reference implementation's regex semantics.**
  Its patterns run without JavaScript's `u` flag, where `\b`, `\d` and
  `[a-z]` are ASCII; Rust's are Unicode. Four ways the same shared tool
  gave two answers, all found by generating documents rather than
  writing them:

  - `#abcé` — `é` is a word character to Unicode, so the boundary never
    closed and the hex was missed here and found there.
  - `rgb(١, 2, 3)` — an Arabic-Indic digit satisfied `\d`, so this
    reported a colour the extension did not.
  - `whiteK` — `(?i)[a-z]` folds U+212A to `k`, so this read one long
    word where the extension read `white`.
  - `rgb(1,\u{feff}2, 3)` — U+FEFF is whitespace to JavaScript and not
    to Rust (and U+0085 is the reverse), and a call is validated after
    its whitespace is stripped.

- **An attribute value is measured in UTF-16 code units.** The
  whole-value rule compares the attribute against the literal found in
  it, and comparing bytes to a JavaScript length meant
  `fill="rgb(1,\u{feff}2, 3)"` was one colour on one server and none on
  the other.

- **Report paths use `/` on every platform.** stdout is protocol: a
  report whose paths change shape with the operating system cannot be
  diffed between two machines, and a sibling shipped `\` on Windows for
  a release before anything asserted it. Unix file names holding a
  backslash are untouched.

- **`xml` runs the SVG extractor, and stops under-reporting.** It ran
  the markup-HTML extractor here and the markup-SVG one on the
  extension, so for `<rect fill="#1a2b3c"/>` under `format: "xml"` the
  extension returned the colour and this returned nothing — the same
  shared MCP tool, two answers, in the worst direction. Resolved towards
  the extension, which is the reference implementation and finds
  strictly more: the SVG attribute list is the HTML one plus five.
  `bgcolor` joins the SVG list so that routing `xml` there loses nothing
  it used to find, which also means an `.svg` carrying `bgcolor` now
  reports it.

  `fixtures/aliases.json` gains an `extractors` table and both sides are
  now checked against it. The alias check could not have caught this:
  both frontends resolved `xml` to `xml` and then disagreed a layer
  below. Corpus case: `chart.xml`, carrying `bgcolor` and `fill`
  together.

- **`typescriptreact` is a format again.** The extension accepted it;
  this refused it, and the refusal looked like an answer —
  `{"colors": [], "fileType": "unknown"}`, no error — for the caller
  most likely to send a VS Code language id. Every `.tsx` document an
  agent handed to the CLI came back empty.

### Added

- **`fixtures/aliases.json`**, the alias table both frontends are now
  held to: a unit test here, `scripts/check-extraction-parity.ts` on the
  extension. The table was ported by hand twice, which is how it drifted
  in the first place, and nothing in either build would have noticed.
- **Six CI jobs, each because something got through.** `hazards` and
  `platform` on macOS, Windows and Linux; `differential`, `fuzz`,
  `budget` and `coverage-matrix` on Linux. `differential` generates
  documents and requires the shared `extract_colors` tool to answer
  identically on both servers — the contract the `xml` bug broke, which
  a hand-written corpus cannot police because it only holds cases
  somebody thought of. `fuzz` runs 60 seconds per target over the pure
  layer, seeded from multi-byte documents in `tests/seeds/` because the
  corpus is deliberately ASCII. `budget` puts a wall-clock ceiling and a
  linearity check on a 500-file tree. Between them they found four
  divergences and one abort, all listed above.
- **Five corpus documents** — `theme.styl`, `app.js`, `compose.yaml`,
  `config.toml` and `release.txt` — so that every one of the fourteen
  formats the tool schema advertises has a document pinning what it
  reads. Five did not, and nothing said so; the check is now driven off
  `SUPPORTED_FORMATS` on both sides, so adding a format to the schema
  fails the build until the corpus covers it.
- **Two corpus documents**: `notes.md`, which pins that `#250` is an
  issue reference and `#FFF` is a colour in the same file, and
  `tokens.json`, a design-token file whose `#250` *is* one.

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
