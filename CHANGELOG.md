# Changelog

All notable changes to Colors-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file covers the **VS Code extension**, the npm MCP server and the
npm command line. The Rust CLI in `crate/` keeps its own
[CHANGELOG](crate/CHANGELOG.md). From 2.6.0 every surface carries one
version and releases from one tag.

## [Unreleased]

### Fixed

- **Every message, button, progress title and tooltip goes through the runtime bundle.** Analyze, Convert, Filter, Validate, Deduplicate, Sort, the clipboard, the safety dialog and the status bar spoke English in every locale, and four strings already wrapped for translation were missing from the bundles. A test now reads the source for all of it.
- **The Named format can be allowed in Validate in every language.** The choice was read off the translated label, so outside English a named color was never allowed.
- **The German settings text keeps the product name.** It read "Farben-LE".
- **The help document reads in the host's language.** It was one English
  template in every locale. Every sentence goes through the runtime bundle
  now, and the command titles in it are held to the palette's, locale by
  locale.
- **The help document describes the extension that ships.** It listed
  four file types after fourteen had a reader of their own, five
  notations after fourteen were found, told a user who found no colors to
  check that the file type is supported when every document is read, and
  named the last command "Help" where the palette shows "Help &
  Troubleshooting". A test holds its command list to the manifest and its
  format list to the extractor's.
- **`notificationsLevel` governs Analyze, Convert, Filter and Validate.**
  The four showed their "No active editor", "No colors found" and
  completion toasts directly, so `silent` and `important` silenced the
  other commands and not these.
- **Cancelling an extraction is reported as a cancel.** Clicking Cancel on
  the progress notification produced the error toast "Color extraction
  failed: Operation cancelled by user" and an error event in the telemetry
  log.
- **Validate reports a contrast it could not compute as that.** A value
  the converter could not read had a contrast ratio of 1, so the report
  said "Contrast ratio 1.00:1 fails WCAG AA" about a colour nothing had
  measured.
- **The analysis report claims only what it computed.** It printed "WCAG
  AA Compliance: ✅ Pass" for every palette, with a contrast ratio nothing
  had measured; contrast needs a background and the report now says it was
  not assessed and where to check it. Any three colours were a "potential
  gradient sequence" at 70% confidence; a gradient is now a run of shades
  of one hue stepping one way. A hex beginning with `0` counted as blue, so
  green and white were a "blue and white theme"; blue is read from the hue.
  Hues were averaged on a line, so 350° and 10° had a dominant hue of 180°,
  the opposite side of the wheel, and two reds either side of 0° were never
  monochromatic.
- **Sort Colors by hex orders the digits, in no locale.** It sorted by the
  host's collation: on a Danish host `#aa0000` came after `#ff0000`, and on
  an English one two spellings of one value swapped places on every sort.
- **The reports' timings are whole milliseconds.** "Analysis Time:
  2.8999999999999986ms" was the raw difference of two timestamps.
- **Deduplicate Colors and Sort Colors no longer wipe a document that is
  not a six-digit-hex, `rgb()` or `hsl()` list.** Both kept only the lines
  that matched those three shapes and wrote them back over the whole
  document: a results list carrying a short hex, an `rgba()`, an `hwb()`
  or a keyword lost those lines, and a stylesheet, which has no bare
  colour line at all, became an empty file reported as "Removed 0
  duplicate colors (0 remaining)". Every notation Extract reports is a
  colour now, and a document with any other line is refused untouched,
  naming the line. Both commands, and Extract writing in place, keep the
  document's own line ending and its trailing newline; a CRLF document was
  written back with bare newlines and a terminator was dropped every time.
- **Validate, Filter, Analyze and Convert read every notation Extract
  reports.** A keyword such as `red` or `transparent` and a four-digit hex
  such as `#f0a8` were found by Extract and then called "Invalid color
  format" by Validate and Analyze and dropped by Filter's invalid-colour
  option, and Convert answered "Unable to parse color" for the four-digit
  hex. Only a six-digit hex, a legacy `hsl()` and the CSS Color 4 syntax
  had a hue, saturation or lightness at all, so an `rgb()`, an `rgba()`,
  an `hsla()`, a short hex or a keyword passed every lightness and
  saturation filter untested and sat out the harmony, temperature, mood
  and cluster analysis. A functional call in capitals could not be read. A
  hue just under 360 rounded to 360, which no range on the wheel includes.
- **Every MCP server this repository ships refuses an argument that does
  not fit the tool's schema as a protocol error, `-32602`, in the same
  words.** A `format: 7` was read as absent, a `dedupe: "yes"` or
  `hidden: "yes"` as false, an argument the schema does not declare was
  accepted, an entry of `paths` that was not a string vanished and the list
  was then called empty, and a schema violation came back as the tool's own
  failure, which a host shows to the agent as a broken tool. The crate's
  server refused a cap written as `5.0` or `1e3` that the other two read.
  `additionalProperties: false` is enforced on both tools.
- **`grey`, `darkgrey`, `darkslategrey`, `dimgrey`, `lightgrey`,
  `lightslategrey` and `slategrey` are extracted.** CSS spells those seven
  keywords both ways and the extractor knew the `gray` spellings alone, so
  `color: grey` was found by nothing: not Extract, not the workspace scan, not
  the MCP server, not the command line. The converter's table carried all
  seven, and 2.4.0's "all 148 CSS keywords" was true of it and not of the
  extractor. The shared corpus pins one now, and a test holds the extractor's
  list to the converter's table.
- The extension's MCP server, the one `colors-le-mcp` and the editor run, died
  on an unhandled EPIPE with a Node stack trace when the client closed the
  pipe, which a host logs as the server crashing. It exits 2 quietly at the
  first reply it cannot write, as the crate's server and the npm command
  line do.
- The npm command line's MCP server dropped a frame that was not JSON, not
  UTF-8, not a JSON-RPC 2.0 request or led by a byte order mark without a
  word, where the extension's server answers a parse error; it answered a
  request with a null id, which the extension's server reads as a
  notification; it refused an unknown method, an unknown tool and a call
  naming no tool in its own words; and it held a frame until its newline
  with no ceiling, so a client that streamed without one grew the process
  without bound. It answers every malformed frame in the extension server's
  words now, refuses a frame over 16 MiB and serves the next line, reads a
  last line with no newline as the partial frame it is, joins the chunks of
  a line once at its newline rather than on every chunk, and waits for the
  pipe to drain before reading the next frame.
- The extension's MCP server answered `initialize` with whatever protocol
  version the client asked for and a `listChanged: false` capability, where
  the crate's server answers its own version and `tools: {}`; it replied to
  an `initialize` with no id; it answered `notifications/initialized` sent
  with an id with nothing, where the crate's server refuses an unknown
  method; and a frame led by a byte order mark was read as a request here
  and refused as not JSON there. The three servers answer one handshake and
  one malformed frame alike now. The server also stops reading while the
  pipe to a slow client is full, so what it holds is bounded by the
  requests in flight.
- The MCP server answered a `filename` or `format` that is an
  `Object.prototype` name, such as `constructor` or `__proto__`, with a
  function or an object for its file type. It answers as it does for any
  unknown format.
- A number setting cleared to an empty string or null read as 0 and was
  clamped to its floor, so the size guard became 1,000 bytes. It falls back
  to the default.
- A folder or workspace scan counted a file deleted or made unreadable after
  it was listed as "not UTF-8 text". It has its own line in the report:
  "N file(s) could not be read."
- The MCP server held every byte of a frame until its newline, with no
  ceiling, so a client that streamed without one grew the process without
  bound and got no answer. A frame over 16 MiB is refused with a parse error
  and the next line is served.
- A failure inside a command, such as the editor refusing to open a document
  or a dialog going away, escaped as an unhandled rejection the editor
  reported in its own words, home directory included. Every command reports
  it as one redacted, localized error.
- The crate release workflow read a crates.io answer it could not parse, or
  a failed request, as "unpublished" and would have let the publish run. It
  refuses to publish without a version list.

## [2.6.7] - 2026-10-18

### Changed

- **Activates once the window has started, instead of on 16 language
  IDs.** vsce publishes every `onLanguage:` activation event as a marketplace
  tag, and Open VSX scores tags, so 16 language names diluted the
  keywords people search for. Colors-LE, its status bar item and its MCP server
  are now ready in every window shortly after startup, rather than when the
  first file in one of those languages opens.

- **The name carries the next words people search for.** Colors-LE ranked
  45th for "hex color" and 43rd for "color extractor" on 2026-10-18, because
  neither "hex" nor "extractor" was in the name. The name is now "Colors-LE:
  Hex Color Extractor & Palette Checker". "hex colors" joins the keywords and
  "design tokens", which ranked 76th, leaves them.

## [2.6.6] - 2026-10-18

### Changed

- **The listing carries the words people search for.** Open VSX ranks a
  match in the name five times a match in the description, and "Colors-LE"
  holds "colors" but not "color", which Open VSX does not match to it, so a
  search for "color" put it outside the top 300 on 2026-10-18. The name is
  "Colors-LE: Color Palette Checker", the description opens with "Color
  extractor and palette checker", where a card has room for about forty
  characters, and the keywords are cut from 30 to 13 phrases someone would
  search for.

## [2.6.5] - 2026-10-17

### Fixed

- **`mcp` no longer ends the session on a frame that is not UTF-8**, in
  the crate or the npm package. Such a frame is dropped like one that is not
  JSON, and the requests after it are served. The npm server reads frames
  with `src/cli/frames.ts`, the crate server's framing in one file shared
  across the family, and `check:cli-pipes` now feeds both servers eighteen
  malformed frames and requests and compares the answers.
- **The npm `mcp` server answers every request as the crate does.** It ran
  on the extension's MCP transport, which differs from the crate on
  requests a client should not send: it refused a frame with no `jsonrpc`,
  ignored a null id, answered a malformed frame with a parse error, echoed
  the client's protocol version, worded an unknown method or tool
  differently, and dropped a last line with no newline. It now runs the
  crate's protocol, in `src/cli/mcp.ts`, over the extension's tools.

## [2.6.4] - 2026-10-17

### Fixed

- **The npm command line no longer crashes when its reader goes away.**
  A reader that closed stdout early, as `| head` does, got a Node stack
  trace and an exit code of 1, or 0 in some tools. It now gets what the
  Rust CLI prints, `colors-le: could not write the report: Broken pipe (os error 32)`, and exit 2.
  A reader that closes stderr early no longer stops the run, and stdout
  is written in full. `colors-le mcp` exits 2 without a word when it cannot
  write a reply, as the crate's server does.
- The listing on stderr now follows the reports written to stdout before
  it, as the crate's does. `scripts/check-cli-pipes.ts` closes each pipe
  under both binaries on macOS, Windows and Linux and fails on any
  difference.

## [2.6.3] - 2026-10-17

### Fixed

- **The npm command line no longer cuts off the end of stderr.** It exited
  once stdout had drained, while stderr could still hold the end of the
  listing and its summary line. On macOS and Windows a pipe writes
  asynchronously, so a reader slower than the writer lost them. It now
  exits once both streams have drained.

## [2.6.2] - 2026-10-16

### Fixed

- **The npm command line words an OS error as the Rust one does on
  Windows.** It said `No such file or directory (os error 4058)` where the
  crate said `The system cannot find the file specified. (os error 2)`,
  because Node hands over libuv's POSIX name for a Windows error. It now
  recovers Windows' code and sentence from that name. On Linux it words
  `EBUSY` as glibc does.
- The command-line parity check ran the npm package under Bun rather than
  Node, and only on Linux. It runs Node, as `npx` does, on macOS, Windows
  and Linux.

## [2.6.1] - 2026-10-15

### Fixed

- The npm command line now words an unreadable directory as the Rust CLI
  does, `IO error for operation on <dir>: Permission denied (os error 13)`.
  2.6.0 dropped the `IO error for operation on` part, the one place the
  two binaries printed different text. The parity check now covers an
  unreadable directory.

## [2.6.0] - 2026-10-15

### Changed

- **One version for every surface.** The extension, the MCP server on
  npm, the new npm command line and the Rust crate all release as 2.6.0
  from the tag `v2.6.0`. The crate jumps from 0.4.4 to join them, and CI
  now fails a commit where any of them disagree.

### Added

- An npm command line, `colors-le`, built in `cli/` from `src/cli/`. It is
  the Rust CLI's surface over this extension's extraction engine: the same
  flags, walk, palette check, exit codes, JSON Lines and stderr summary, and
  `colors-le mcp` serves the same two tools. `scripts/check-cli-parity.ts`
  runs both binaries over one tree and fails on any byte of difference.
  It is published as `colors-le` on npm, beside `colors-le-mcp`.

### Fixed

- The rating prompt's Rate button opened the Marketplace review page for
  every install, including one from Open VSX in VSCodium, Cursor or
  Windsurf, because it told the registries apart by a publisher name the
  Open VSX listing does not carry. It reads the editor's name instead, and
  an Open VSX install rates on Open VSX.

## [2.5.0] - 2026-10-07

### Added

- A rating prompt. On the 3rd successful use, one notification asks whether
  you would rate the extension, with *Rate*, *Later* and *Don't Ask Again*.
  *Rate* opens the registry your copy was installed from: the VS Code
  Marketplace or Open VSX. *Later*, or dismissing it, asks once more on the
  20th use; that second ask is the last. It never appears on activation or
  after a failed run, and it is never shown if you have set
  `notificationsLevel` to `important` or `silent` yourself. The answer
  follows you through Settings Sync. Translated into all 12 locales.
- Extract across a folder or the whole workspace.
  `Colors-LE: Extract Colors from Workspace` reads every file in the workspace
  from disk, and `Colors-LE: Extract Colors from Folder` does the same for one
  folder, from the command palette or from a folder in the Explorer. The
  report is the palette: each color once however it is spelled, so `#f00`,
  `#FF0000`, `red` and `rgb(255, 0, 0)` are one row, with the spellings, how
  often it is written, in how many files, and where. It ends with a line for
  each thing the scan left unread.
- A scan skips three things by default, each with its own switch:
  dependency folders, build output, caches and lockfiles
  (`colors-le.workspace.scanUseDefaultExcludes`), whatever the project's
  `.gitignore` files skip (`colors-le.workspace.scanRespectGitignore`), and
  images, fonts, archives and other files that are not text
  (`colors-le.workspace.scanSkipBinaryFiles`). `colors-le.workspace.scanExcludes`
  skips more, and `colors-le.workspace.scanAlwaysInclude` reads a path whatever
  the switches say. `colors-le.workspace.scanPatterns` chooses the files to
  read in the first place.
- `colors-le.workspace.scanMaxFiles` caps how many files are read and
  `colors-le.workspace.scanMaxResults` caps how many occurrences are listed.
- The positions settings apply to a scan as they do to Extract: off by
  default, and then each line is a file and how many times the color is in it.
- Positions are now a setting. `colors-le.showPositions` decides whether the
  output gives the line and column of each color, and
  `colors-le.clipboardIncludesPositions` decides the same for the copy on the
  clipboard. Both are off by default, so the output is what it was. With
  positions shown, Sort still orders by the color and keeps each position with
  it, and Dedupe keeps the first occurrence of a color, with that occurrence's
  position.

### Changed

- No command is bound to a key by default any more. The one default this
  extension shipped sat on a key the editor, the system or another LE
  extension already used. Every command can still be given a key under
  Keyboard Shortcuts.

## [2.4.3] - 2026-10-04

### Fixed

- The Open VSX links and the Open VSX downloads badge in the README, the npm
  README and the Help command pointed at a namespace the listing has left, so
  they led nowhere. The listing is under `nolindnaidoo` now, and so are they.

### Removed

- The Zed extension in `zed/`, with the CI job that built it and the workflow
  that synced it. It was never listed in Zed's registry.

## [2.4.2] - 2026-10-03

### Fixed

- **`extract_colors` described only the notations it had before 2.4.0.** The
  tool's description listed hex, rgb, hsl and named colors; it now names hwb,
  lab, lch, oklab, oklch and color() as well, which it has reported since.

### Added

- `scripts/check-mcp-definition.ts`, run in CI after the differential: it fails
  when the two servers define the shared MCP tool differently — its
  description or any part of its schema. Six of the ten had drifted.
- The npm README test also checks that every value an argument offers is
  named in that argument's row.

## [2.4.1] - 2026-10-03

### Fixed

- The npm README's example is now an answer the server actually gives, and it
  names every notation reported, including the CSS Color 4 functions 2.4.0
  added.
- **A Zed pull request was linked as pending review** in both READMEs. It was
  closed without merging; both now say there is no Zed listing yet and link
  Zed's instructions for adding the MCP server by hand.
- The npm README's list of the family's Rust tools left out `dates-le`.

### Added

- `src/mcp/readme.test.ts` holds the npm README to the tool it documents: the
  heading names the tool, the argument table lists exactly the schema's
  arguments, the required ones are marked, the example is this tool's answer,
  and the opening sentence names what the tool works on.

## [2.4.0] - 2026-09-30

### Added

- **Modern CSS colour syntax is extracted.** `rgb(255 0 0 / 50%)`,
  `hsl(120deg 100% 50%)`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`
  and `color()` in the nine predefined spaces were invisible, which left
  every Tailwind v4 palette, written in `oklch()`, unreported. They are
  found in every format, reported under their own format names (`hwb`,
  `lab`, `lch`, `oklab`, `oklch`, `color`), and read by convert, analyze,
  filter and validate: a CSS Color 4 value converts to hex, rgb, hsl or
  oklch like any other. A colour outside sRGB is clipped when converted.
- Relative colours, `calc()` and `var()` inside a colour call are still not
  read, and are refused rather than guessed at.

### Fixed

- **Convert to OKLCH was wrong for every colour.** It relabelled the HSL
  values as OKLCH, so red came out `oklch(0.5 0.4 0)`. It now converts
  through OKLab: red is `oklch(0.628 0.258 29.23)`, and alpha is kept as
  `/ a` when asked to preserve it.
- **Most named colours could not be converted.** The extractor finds all
  148 CSS keywords, but the converter knew 19, so `coral` or
  `rebeccapurple` failed. It now knows them all.

## [2.3.1] - 2026-08-16

### Fixed

- **Element text and inline SVG colours are read.** A colour written as
  the text of an element, and one written inside an inline `<svg>`, were
  both skipped — so a document could report no colours while plainly
  holding several. Fixed on both frontends, and the shared corpus covers
  it.

### Changed

- **New icon artwork.** A new drawing in the style the family is moving
  to, framed like the rest of the set.

### Fixed

- **The agent-files check no longer times out on Windows.** A test-only
  fix; nothing a user of the extension can observe.

## [2.3.0] - 2026-08-14

### Changed

- **Extract works in every document.** JSON, JSONC, YAML, TOML, Markdown
  and plain text are read by name — a design system keeps its tokens in a
  `.json` — and any other language id is read as raw text rather than
  quietly extracted as CSS. `metadata.fileType` says which of the two you
  got.

- **Two rules keep prose honest.** Both apply *only* where the syntax is
  unknown — Markdown, plain text, and language ids with no extractor of
  their own. Stylesheets and token files are untouched:

  - **A short hex in prose must contain an `a`-`f`.** `#250` in a README
    is an issue reference, not a colour. Measured rather than assumed:
    across 1,988 Markdown files there were 56 bare 3- and 4-digit hex,
    and 50 of them — every all-digit one — were issue or pull-request
    references, while all six containing a letter were real colours.
    `#250` in a token file or a stylesheet is still a colour.
  - **A named color must be the whole value.** `"paper": "white"` is a
    color; a paragraph mentioning orange, and a
    `className="… text-white …"`, are not.

- **The `extract_colors` MCP tool no longer refuses a call with no
  usable format.** It reads the document as raw text and reports
  `fileType: "unknown"`, matching the Rust server, which never refused
  one.

- **New icon artwork.** All sixteen tools were redrawn in one style, so
  the family reads as one set wherever the listings sit side by side —
  the Marketplace, Open VSX and letools.dev. The framing is unchanged:
  the drawing fills 65.8% of an 800×800 canvas, and every smaller size
  is derived from that one file rather than drawn again.

### Fixed

- **`bgcolor` is read in SVG and XML documents.** It was recognised in
  HTML only, so a `<chart bgcolor="#f0a">` read as `xml` lost its one
  color. **If you extract from `.svg` or `.xml` files, expect findings
  this release that the last one missed.** The same change settles an
  `xml` disagreement with the Rust CLI, which ran the HTML extractor
  there and missed `fill` attributes; the format-to-extractor mapping is
  now pinned for both frontends in `crate/fixtures/aliases.json`.

### Added

- **A generated check that both `extract_colors` servers agree.**
  `scripts/check-extraction-differential.ts` builds documents from a
  format, a value, a wrapper and a neighbourhood — including characters
  wider than one byte — and requires this server and the Rust one to
  return the same answer for each. The shared corpus pins the cases
  somebody thought of; this generates the rest, and it found four ways
  the two disagreed, all of them fixed on the Rust side. **Only the
  shared tool is compared**: the surfaces around it differ by design,
  and `crate/SPEC.md` lists how.

- **Five corpus documents** — `theme.styl`, `app.js`, `compose.yaml`,
  `config.toml` and `release.txt` — so every one of the fourteen formats
  the tool advertises has a document pinning what it reads. Five had
  none, and the check that would have said so was a hand-written list;
  it is driven off `SUPPORTED_FORMATS` now, on both sides.

- The MCP server's alias table is now checked against
  `crate/fixtures/aliases.json`, which the Rust CLI checks itself
  against too. The two tables were ported by hand and had already
  drifted: `typescriptreact` was accepted here and refused there.

- A **Rust CLI and MCP server**, in [`crate/`](crate/README.md),
  published to crates.io as `colors-le`. It runs the same extraction over
  a whole tree and, given a palette, fails a build on a color that is not
  in it — matched by color rather than by spelling, so a palette in hex
  catches a violation written in `rgb()`.

  Only extraction is ported; convert, analyze and validate are
  interactive and stay here. The extension remains the reference
  implementation and `crate/fixtures/` is the contract.

**Still not extracted**, and deliberately: modern color syntax —
`rgb(255 0 0 / 50%)`, `lab()`, `lch()`, `oklch()`, `color()` — along
with `currentColor` and SCSS/LESS variable references.

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
