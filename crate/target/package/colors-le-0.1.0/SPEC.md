# colors-le — Rust specification

A port of the [Colors-LE](https://github.com/nolindnaidoo/colors-le) VS
Code extension to a Rust CLI and MCP server: find every colour in a
codebase, and say which of them are not in your palette.

**Parity first.** For extraction, the extension is the reference
implementation. The colours this finds, their notation, and their order
must match what the extension finds. A difference is a regression until
proven otherwise.

## The one question

**What colours does this product actually use, and are they the ones it
is supposed to use?**

Asked over a whole repository rather than one stylesheet, answered with
an exit code a CI step can fail on.

## Who asks it

A design-system owner, a brand reviewer, a front-end lead inheriting a
codebase. The palette is a document — a brand guide, a Figma library, a
`tokens.json` — and the codebase is supposed to agree with it. Nobody can
check that by reading, because the colours are spread across a thousand
files in six notations, and `#FFF`, `#ffffff`, `rgb(255,255,255)` and
`white` are the same colour written four ways.

Two jobs follow from that, and they are the same extraction pointed in
opposite directions:

- **Enforcement** — here is the palette; tell me what is not in it.
- **Discovery** — there is no palette yet; tell me what is in use so one
  can be written.

## Half the extension, on purpose

The extension does four things. This ports one.

**Ported — extraction.** Find the colours, classify their notation,
report where they are. That is also exactly what the extension's own MCP
tool offers, which is the strongest signal available about which half
travels.

**Not ported — convert, analyze, validate.** All three are interactive:
they open a quick-pick, ask what you want, and render a report into a
new editor tab. Converting a palette to `hsl` is something you do once
while looking at it; a CI step does not have a preference.

Two of them would also be expensive to be honest about. Conversion
rounds with JavaScript's `Math.round` and can be asked for unrounded
components, which lands straight in the number-rendering problem
numbers-le exists to solve. **`validate` already computes WCAG contrast
ratios** — that capability is real and it is deliberately left where it
is for now; a contrast auditor is a different product with a different
shape, and shipping half of one is worse than shipping none.

## The palette check — the addition

Extraction alone answers discovery. Enforcement needs one thing the
extension has no equivalent for: a palette to compare against.

`--palette <file>` reads a list of colours — one per line, or a JSON
array, or a flat JSON object's values — and every extracted colour that
is not in it becomes a finding. **Comparison is by colour, not by
text**: `#FFF`, `#ffffff` and `rgb(255, 255, 255)` are one entry, because
a palette written in hex must still catch a violation written in rgb.

This is outside parity scope. The extension has nothing to disagree
with, and it is marked in the report so a reader can tell an extraction
from a judgment.

**Named colours are only equal to themselves.** `white` and `#ffffff`
are the same pixel and not the same decision — one is a keyword nobody
approved and the other may be the brand's paper colour. Resolving
keywords to hex would quietly launder the first into the second.

## Shape

**One crate.** Self-contained: no published `-core`, no shared crate
with the family, and nothing holding this code equal to the similar
files in the sibling repos.

```
crate/
├── src/
│   ├── extract/    pure: the matchers, the format extractors, palette
│   │               comparison, positions. No filesystem, pub(crate).
│   ├── walk.rs     ignore-aware tree walking
│   ├── scan.rs     one file end to end — the only path either surface calls
│   ├── cli.rs      the terminal surface
│   └── mcp/        the agent surface
└── fixtures/       the shared corpus, read by both frontends
```

**`extract/` touches no filesystem** and carries the **90% line coverage
floor per module**.

## Extraction — parity scope

### What counts as a colour

- **Hex** — 3, 4, 6 or 8 digits. Other digit counts are rejected
  outright, so `#12345` is not a colour.
- **Functional** — the legacy comma syntax `rgb()`, `rgba()`, `hsl()`,
  `hsla()`, with whitespace including newlines allowed anywhere inside
  the call. **A multiline call is found and its value is normalised to
  single spaces**, while the position still points at the first
  character in the source.
- **Named** — the CSS keywords plus `transparent`, and **only where the
  caller supplies value segments**: declaration values, attribute
  values, whole string literals. Never as a bare word in prose, or every
  sentence containing "orange" would be a finding.

Components are validated, so a call with the wrong arity or a missing
`%` is rejected rather than reported as a colour.

### What is deliberately not a colour

Ported limitations, not gaps to fix here:

- **Modern space-separated syntax** — `rgb(255 0 0 / 50%)` — and
  `lab()`, `lch()`, `oklch()`, `color()`.
- **`currentColor` and `inherit`**, which are indirections rather than
  colours.
- **SCSS and LESS variable references.** `$brand` is a name; the colour
  is wherever it was defined.

### Comments are blanked before matching

Per syntax — CSS block, CSS line, JavaScript, HTML — so a commented-out
declaration is not a finding. Blanked rather than removed, so every
offset after it still points where it did.

## Output contract

**stdout is protocol, stderr is human.** One JSON report per line, one
line per file.

```json
{
  "file": "src/theme.css",
  "format": "css",
  "colors": [
    { "value": "#1a2b3c", "notation": "hex", "line": 4, "column": 12, "inPalette": true },
    { "value": "rgb(255, 0, 0)", "notation": "rgb", "line": 9, "column": 3, "inPalette": false }
  ],
  "diagnostics": [],
  "summary": { "colors": 2, "outsidePalette": 1 }
}
```

`inPalette` is absent entirely when no palette was given — a field that
was always `true` would read as a verdict nobody asked for.

### Exit codes are the API

- **0** — colours found, and none outside the palette.
- **1** — no colours found, **or** at least one outside the palette.
- **2** — the question was malformed.

That 1 carries two meanings is deliberate and follows grep: without a
palette this is an extractor and 1 means "none found"; with one it is a
check and 1 means "a violation". A run cannot be both, because a run
with a palette that found nothing has nothing to violate.

## The CLI surface

```
usage: colors-le [options] <file|dir>...
       colors-le [options] --stdin --format <format>
       colors-le mcp
       colors-le --version | --help

Options:
  --palette <file>     a list of approved colours; anything else is a
                       finding. One per line, or a JSON array, or a flat
                       JSON object's values
  --dedupe             collapse repeated colours to their first
                       occurrence **within each file**
  --values             print only the colours, one per line, for piping
  --format <format>    force a format instead of inferring it from the
                       file name; required with --stdin
  --stdin              read one document from stdin
  --hidden             walk hidden files and directories too
  --no-ignore          walk files that .gitignore excludes
```

`--values --dedupe | sort -u` with no palette is how a palette gets
written in the first place. `--dedupe` collapses within each file, which
is what the extension does; across a tree the last step is `sort -u`, and
saying so beats a flag that quietly means something different here.

## The MCP surface

- **`extract_colors` belongs to both servers**: same schema, same
  envelope, byte-identical output. `fixtures/mcp-extract-colors.json`
  runs against both.
- **`colors_le_scan` is this server's own**: files or directories in,
  the same reports the CLI writes, palette included.

## Non-goals

- **It does not convert.** See "Half the extension, on purpose".
- **It does not score contrast.** The extension does; that capability
  stays there until a contrast auditor is designed as its own thing.
- **It does not rewrite a colour**, and never writes to a scanned file.
- **No network, ever.**

## Not in v1

- **WCAG contrast**, deliberately — see above.
- **Modern colour syntax**, which is a parity change and belongs in both
  frontends at once.
- **Perceptual nearest-match** — "this is 2% off brand blue". That needs
  a colour space this does not carry and a tolerance nobody has agreed.
