<p align="center">
  <img src="https://raw.githubusercontent.com/nolindnaidoo/colors-le/main/src/assets/images/icon.png" alt="colors-le logo" width="96" height="96"/>
</p>

<h1 align="center">colors-le</h1>

<p align="center">
  <b>Find every colour in a codebase, and say which are not in your palette</b><br/>
  <i>matched by colour, not by spelling</i>
</p>

<p align="center">
  <a href="https://crates.io/crates/colors-le">
    <img src="https://img.shields.io/crates/v/colors-le.svg" alt="colors-le on crates.io" />
  </a>
  <a href="https://crates.io/crates/colors-le">
    <img src="https://img.shields.io/crates/d/colors-le.svg" alt="crates.io downloads" />
  </a>
  <a href="https://github.com/nolindnaidoo/colors-le/actions/workflows/ci-crate.yml">
    <img src="https://github.com/nolindnaidoo/colors-le/actions/workflows/ci-crate.yml/badge.svg" alt="Build Status" />
  </a>
  <img src="https://img.shields.io/badge/rustc-1.88+-93450a.svg" alt="MSRV: Rust 1.88+" />
  <a href="https://github.com/nolindnaidoo/colors-le/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  </a>
  <a href="https://letools.dev/tools/colors-le">
    <img src="https://img.shields.io/badge/web-letools.dev-00A0FF.svg" alt="letools.dev" />
  </a>
</p>

> **Useful?** A star is how other developers find it —
> [★ GitHub](https://github.com/nolindnaidoo/colors-le) ·
> [letools.dev/tools/colors-le](https://letools.dev/tools/colors-le)

The brand guide says six colours. The codebase has ninety, spread across
a thousand files in six notations, and `#FFF`, `#ffffff`,
`rgb(255, 255, 255)` and `white` are the same colour written four ways.
Nobody can check that by reading.

```bash
colors-le --palette brand.txt .
```

```
./src/theme.css:4:12  #1a2b3c
./src/legacy.scss:88:3  rgb(255, 0, 0)  ← not in palette
22 colors in 75 files
17 colours are not in the palette
```

Exit code 1. The build stops before the design review does.

## Two jobs, one extraction

**Enforcement** — here is the palette, tell me what is not in it.

**Discovery** — there is no palette yet, tell me what is in use so one
can be written:

```bash
colors-le --values --dedupe . | sort -u > brand.txt
```

## Matched by colour, not by spelling

A palette written in hex still catches a violation written in `rgb()`.
`#FFF`, `#ffffff` and `rgb(255, 255, 255)` are one entry, because a
check that compared text would be a spelling test.

**Alpha is part of the identity.** `rgba(0, 0, 0, 0.5)` is not black — a
palette approving the one would otherwise approve every translucent
overlay in the codebase.

**Named colours are only equal to themselves.** `white` and `#ffffff`
are the same pixel and *not* the same decision: one is a keyword nobody
approved and the other may be the brand's paper colour. Resolving
keywords to hex would quietly launder the first into the second, which
is the opposite of what an enforcement check is for.

A colour the tool cannot resolve is **never** treated as approved. The
safe direction is to surface it: a notation nobody can read is exactly
what a reviewer should look at.

## Install

| Route | Command | Worth knowing |
|---|---|---|
| **cargo** | `cargo install colors-le` | Any platform, needs **Rust 1.88+**. |
| **From source** | `git clone https://github.com/nolindnaidoo/colors-le`<br>`cd colors-le/crate && cargo build --release` | The same build CI runs. |

No runtime, no network, nothing written.

## What counts as a colour

**Hex** — 3, 4, 6 or 8 digits, and nothing else, so `#12345` is not a
colour. **Functional** — the legacy comma syntax `rgb()`, `rgba()`,
`hsl()`, `hsla()`, validated component-wise, so `rgb(1, 2)` is not one
either. **Named** — the CSS keywords plus `transparent`, and only where
a value is expected.

## What it reads

**Every file in the tree.** CSS, SCSS, LESS, Stylus, HTML, XML, SVG,
JavaScript, TypeScript, JSON, YAML, TOML, Markdown and plain text are
read by name; anything else is scanned as raw text and reported as
format `unknown`, so a colour in a Python constant is still found. The
`format` field on every report says which of the two it was.

Reading a `.json` is the point: it is where a design system keeps its
tokens, and this could not open one before 0.2.0.

**A binary file is passed over silently** — a NUL byte in its first 8KB,
which is ripgrep's rule — and counted in the summary rather than
reported. It was never a text candidate, so it is not a file that failed
to be read, and `--strict` ignores it. A file that *looked* like text and
could not be read is the opposite: named, and still a `--strict`
failure.

That last rule matters more than it sounds: a named colour is a colour
in a declaration value, an attribute value or a whole string literal, and
**never as a bare word in prose**. Without it, every sentence containing
"orange" would be a finding.

**A multiline call is found**, and its value is normalised to single
spaces while the position still points at the first character in the
source. A declaration split across four lines is common in a formatted
stylesheet.

## What is deliberately not a colour

Ported limitations, not gaps:

- **Modern space-separated syntax** — `rgb(255 0 0 / 50%)` — and
  `lab()`, `lch()`, `oklch()`, `color()`.
- **`currentColor` and `inherit`**, which are indirections.
- **SCSS and LESS variable references.** `$brand` is a name; the colour
  is wherever it was defined.
- **Anything in a comment**, in all four comment syntaxes.
- **A short all-digit hex in prose.** In Markdown, plain text and any
  format with no extractor of its own, a 3- or 4-digit hex must contain
  an `a`-`f`: across 1,988 real Markdown files, 50 of the 56 bare short
  hex were issue and PR references — `#250`, `#3050` — and the six with
  letters in them were all real colours. Structured formats and
  stylesheets are untouched: `#250` in a token file is a colour.
- **A named colour a document merely mentions.** Outside a stylesheet
  the value has to *be* the colour, so `"paper": "white"` counts and a
  paragraph about a brand-orange focus ring does not.

`--format` is refused for a name this does not know, even though an
unnamed document is read: `--fromat scss` scanning the tree as raw text
would be a run whose caller believes it parsed stylesheets.

## Half the extension, on purpose

The extension does four things. This ports one: extraction — which is
also exactly what the extension's own MCP tool offers.

Convert, analyze and validate are interactive. They open a quick-pick,
ask what you want, and render a report into a tab. Converting a palette
to `hsl` is something you do once while looking at it; a CI step has no
preference.

**The extension's `validate` already computes WCAG contrast ratios.**
That capability is real and it is deliberately left where it is. A
contrast auditor is a different product with a different shape, and
shipping half of one is worse than shipping none.

## Options

```
--palette <file>     a list of approved colours; anything else is a
                     finding. One per line, a JSON array, or a flat
                     JSON object's values
--dedupe             collapse repeated colours to their first
                     occurrence within each file
--values             print only the colours, one per line, for piping
--format <format>    force a format instead of inferring from the name;
                     required with --stdin
--stdin              read one document from stdin
--hidden             walk hidden files and directories too
--no-ignore          walk files that .gitignore excludes
```

An entry in the palette that is not a colour is **named on stderr**
rather than skipped: a typo silently approving nothing is the worst
outcome available.

### Exit codes

- **0** — colours found, none outside the palette.
- **1** — none found, **or** at least one outside the palette.
- **2** — the question was malformed.

That 1 carries two meanings is deliberate and follows grep. Without a
palette this is an extractor and 1 means "none found"; with one it is a
check and 1 means "a violation". A run cannot be both — a run with a
palette that found nothing has nothing to violate.

## As an MCP server

```bash
colors-le mcp
```

Two tools, both returning `{ ok, data, diagnostics, meta }`:

- **`extract_colors`** — content in, colours out with notation and
  position. Touches no filesystem. The npm server ships the same tool
  with byte-identical output; one corpus runs against both.
- **`colors_le_scan`** — files or directories in, the same reports the
  CLI writes.

The palette belongs to the CLI. An agent handing over document text has
no palette file to point at.

## The other four ways to run it

| Where | What you get | Install |
|---|---|---|
| **VS Code** | Extraction, conversion, analysis and validation in your editor | [Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le) |
| **Cursor, VSCodium, Windsurf** | The same extension | [Open VSX](https://open-vsx.org/extension/OffensiveEdge/colors-le) |
| **Any MCP agent, via Node** | `extract_colors` over stdio | `npx colors-le-mcp` · [npm](https://www.npmjs.com/package/colors-le-mcp) |
| **Zed** | The MCP server as a context server | [zed-industries/extensions#7078](https://github.com/zed-industries/extensions/pull/7078) *(pending review)* |

All sixteen LE tools are on **[letools.dev](https://letools.dev)**.

## Documentation

| What | Where |
|---|---|
| What this tool is allowed to say — scope, output contract, refusals, non-goals | [SPEC.md](https://github.com/nolindnaidoo/colors-le/blob/main/crate/SPEC.md) |
| How the code is written and held together — architecture, invariants, the gates | [AGENTS.md](https://github.com/nolindnaidoo/colors-le/blob/main/crate/AGENTS.md) |
| The VS Code extension this shares its extraction with | [README.md](https://github.com/nolindnaidoo/colors-le/blob/main/README.md) |
| What changed | [CHANGELOG.md](https://github.com/nolindnaidoo/colors-le/blob/main/crate/CHANGELOG.md) |
| The tool's page, and the other fifteen | [letools.dev/tools/colors-le](https://letools.dev/tools/colors-le) |

## More from the LE family

Sixteen single-purpose tools for the work in front of every model. Each ships
a Rust CLI and an MCP server. One page: **[letools.dev](https://letools.dev)**

**Get it out**

- **[String-LE](https://letools.dev/tools/string-le)** — Extract every string in a codebase, with its position, so a person can read them
- **[Numbers-LE](https://letools.dev/tools/numbers-le)** — Extract every hardcoded number in a codebase, so a person can check them
- **[Units-LE](https://letools.dev/tools/units-le)** — Extract every quantity with its unit, normalized, and refuse the ambiguous ones by name
- **[Dates-LE](https://letools.dev/tools/dates-le)** — Extract every date and timestamp, and the exact instant each one resolves to
- **[IDs-LE](https://letools.dev/tools/ids-le)** — Extract every UUID, ULID, NanoID, ObjectId and Snowflake, and decode the time inside
- **[IPs-LE](https://letools.dev/tools/ips-le)** — Extract every IP address, CIDR block and MAC, normalized and classified by scope
- **[URLs-LE](https://letools.dev/tools/urls-le)** — Extract every URL in a codebase, with its protocol and exact position
- **[Paths-LE](https://letools.dev/tools/paths-le)** — Extract every file path in a codebase, and say whether it still points at anything
- **[Colors-LE](https://letools.dev/tools/colors-le)** — Extract every color in a codebase, and say which ones are not in your palette

**Check it**

- **[Regex-LE](https://letools.dev/tools/regex-le)** — Find every regex in a codebase, and report which can be driven into catastrophic backtracking
- **[Versions-LE](https://letools.dev/tools/versions-le)** — Find where one dependency is constrained differently across a repository's manifests
- **[i18n-LE](https://letools.dev/tools/i18n-le)** — Identify the i18n library a project uses, then audit its catalogs by that library's rules
- **[Scrape-LE](https://letools.dev/tools/scrape-le)** — Check whether a page is scrapeable before the scraper is written, and say when it cannot tell

**Guard it**

- **[Secrets-LE](https://letools.dev/tools/secrets-le)** — Find hardcoded credentials in a codebase, and never print one into the report
- **[EnvSync-LE](https://letools.dev/tools/envsync-le)** — Compare the dotenv files in a tree, and say which keys are missing from which
- **[Unicode-LE](https://letools.dev/tools/unicode-le)** — Find the Unicode that hides meaning — bidi controls, invisibles, homoglyphs, mixed scripts

Each stands on its own: no shared crate, no published core. Where two of them
agree, it is because the same answer was right twice.

**Contact** — [nolindnaidoo.com](https://nolindnaidoo.com) · [GitHub](https://github.com/nolindnaidoo) · [LinkedIn](https://www.linkedin.com/in/nolindnaidoo/)

## Also by nolindnaidoo

**Rust** — pixelcoords and pixelactions are one loop: pixelcoords answers
*where*, pixelactions *acts* there. Their own tools, their own voice — not
part of the LE family.

- **[pixelcoords](https://github.com/nolindnaidoo/pixelcoords)** — Freeze your screen, mark regions, get pixel-exact coordinates and crops
  [pixelcoords.dev](https://pixelcoords.dev) · [crates.io](https://crates.io/crates/pixelcoords) · [docs.rs](https://docs.rs/pixelcoords)
- **[pixelactions](https://github.com/nolindnaidoo/pixelactions)** — Consume human-verified coordinates, perform the interaction, confirm it landed
  [pixelactions.dev](https://pixelactions.dev) · [crates.io](https://crates.io/crates/pixelactions) · [docs.rs](https://docs.rs/pixelactions)

## License

MIT — see [LICENSE](https://github.com/nolindnaidoo/colors-le/blob/main/LICENSE).
