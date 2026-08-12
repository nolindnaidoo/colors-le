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

### What it reads

**Every file.** Fourteen formats are read by name — `css scss less
stylus html javascript typescript svg xml json yaml toml markdown
plaintext` — and anything else is scanned as raw text and reported as
format `unknown`. That field is the reader's signal that the answer came
from a scan rather than a parser.

Refusing an unknown format was the 0.1.0 behaviour and it was wrong in
one specific way: it could not open a `.json`, which is where a design
system keeps its tokens. What the refusal protected against is one
collision — `#250` in prose — and that is answered by the short-hex rule
below instead.

`--format` still refuses a name it does not know. Strict parsing applies
to flags; the fallback applies to documents.

**A format name is not an extractor.** `xml` is its own name, because
the name is user-visible as `fileType`, and it runs the **markup-SVG**
extractor — `fill`, `stroke`, `stop-color`, `flood-color`,
`lighting-color`, `color`, `bgcolor` — because an XML document is not
required to be SVG and that list is the superset. The mapping from name
to extractor lives in `fixtures/aliases.json` and both frontends are
checked against it: this is exactly where the two disagreed, with `xml`
running markup-HTML here and markup-SVG on the extension, so
`<rect fill="#1a2b3c"/>` was found there and missed here.

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

### Two rules that only apply outside a stylesheet

The raw scan reads documents whose syntax is unknown, so it carries two
restrictions the format-aware extractors do not.

**A short hex in prose must contain an `a`-`f`.** In `markdown`,
`plaintext` and `unknown`, `#250` is an issue reference. Measured rather
than assumed: across 1,988 real Markdown files there were 377
unambiguous colours and 56 bare 3/4-digit hex — 50 all-digit (`#250`,
`#3050`, `#7077`, `#2378`, every one an issue or PR reference) and 6
containing a letter (`#FFF`, `#abc`, every one real). Heading anchors are
not the collision they look like: `#configuration` and `#faq` cannot
match a hex pattern, because `o` and `q` are not hex digits.
**Structured formats and stylesheets are unaffected** — `#250` in a
token file or a stylesheet is a colour.

**A named colour must be the whole value.** `"paper": "white"` is a
colour; a paragraph reading "brand-orange focus ring" and a Tailwind
`className="… text-white …"` are not. Measured on two real
repositories, matching any keyword inside a value segment produced 35
false findings against 19 real colours. A stylesheet keeps the looser
rule, because there the declaration syntax is known.

### Deliberate divergences

Two things are held equal and the rest is not, and confusing the two
invents bugs in both directions.

**Held equal: the shared `extract_colors` tool.** One tool name, one
schema, two servers. An agent asking for the colours in a document must
get the same answer whichever server it happens to reach — same values,
same notations, same positions, same envelope. `fixtures/` pins the
cases somebody wrote down and the `differential` job generates the rest.
A difference there is a bug, and it is exactly the class the `xml`
divergence belonged to.

**Not held equal: the surfaces.** The extension is IDE-first — one open
buffer, a person reading results in an editor. This is terminal-first —
trees, exit codes, pipes, automation. Each works as its use case
expects, and the following are differences by design rather than drift:

- The **walk**, `--palette`, `--strict`, `--hidden`, `--no-ignore`,
  `--values` and the exit codes exist only here. The extension has no
  tree to walk and nothing to enforce against.
- **JSON Lines on stdout**, one report per file, with a `notation`
  field. The shared tool calls the same thing `format`; both names are
  published API on their own surface and neither moves to match the
  other.
- **Report paths always use `/`**, on every platform, because stdout is
  protocol and a path that changes shape with the operating system
  cannot be diffed between two machines.
- **Convert, analyze and validate** stay in the editor — see "Half the
  extension, on purpose".

**One implementation detail is held equal on purpose**: the extraction
layer uses JavaScript's string semantics, not Rust's. The reference
implementation's patterns run without the `u` flag, so `\b`, `\d` and
`[a-z]` are ASCII there; its `\s` and its `trim` include U+FEFF and
exclude U+0085, where Rust's `char::is_whitespace` does the opposite.
Rust's defaults differ on every one, and each difference made the shared
tool answer differently — for `#abcé`, `rgb(١, 2, 3)`, `whiteK`,
`rgb(1,\u{feff}2, 3)`, and for the format name `"\u{feff}css"`, which
resolved on one server and fell through to the raw scan on the other.

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

## Binary files, and files that cannot be read

These are two different things, and conflating them makes `--strict`
useless.

**A binary file was never a text candidate.** A NUL byte in the first
8 KB — ripgrep's rule, so that "what this considers binary" and "what
ripgrep considers binary" are one answer — and the file is passed over:
**no report line, no effect on any exit code**, and a count in the
stderr summary (`3 colors in 40 files, 16 binary files skipped`) so the
reader can still see coverage was narrower than the tree. Widening the
walk to every file put 14 PNGs, an `.ico` and a `.jpg` in front of one
real repository's reader; reporting each as a failure would have meant
`--strict` exiting 2 on any repository containing an image.

**A file that looked like text and could not be read is a shortfall.**
Invalid UTF-8 with no NUL byte in it, or no permission to open it: that
one keeps its named `skipped` diagnostic and still fails `--strict`.

Exit 2 means the *question* was malformed — an unknown flag, an
unreadable format name, a path that does not exist. It does not mean one
file in fifty thousand was a PNG.

A file that looked like text and is not UTF-8, or that cannot be opened,
is:

- named on stderr,
- carried in the JSON report with a `skipped` diagnostic saying why,
- and left out of the exit code.

`--strict` turns any skipped file back into exit 2, for a pipeline that
wants zero tolerance. What is never allowed is the third option: a file
that silently vanishes from the report, which reads to whoever ran it as
a file that was clean.

## The byte-order mark

A leading BOM is stripped before extraction. It is three invisible bytes
that Notepad, Excel and a PowerShell redirect all add, and that VS Code
removes before the extension sees a document — so leaving it in means
the two frontends read the same file differently. It shifts every column
on the first line, and in a structured format it can lose the document
entirely.

A BOM anywhere other than the start is a zero-width no-break space and
belongs to the text.
