# colors-le

Find every colour in a codebase and, given a palette, say which ones are not
in it. Answered over a whole repository with an exit code a CI step can fail
on.

```bash
npx colors-le src/
npx colors-le --palette brand.txt src/
npx colors-le --values --dedupe src/ | sort -u   # the start of a palette
```

This is the same command line as the Rust crate
[`colors-le`](https://crates.io/crates/colors-le), and it behaves identically:
same flags, same walk, same output, same exit codes. Install whichever
toolchain you already have.

## What it reads

Every file. CSS, SCSS, LESS, Stylus, HTML, XML, SVG, JavaScript, TypeScript,
JSON, YAML, TOML, Markdown and plain text are read by name, and anything else
is scanned as raw text and reported as format `unknown`. Directories are
walked the way ripgrep walks them: `.gitignore`, `.ignore` and hidden files
are respected unless you pass `--no-ignore` or `--hidden`. A binary file is
passed over and counted in the summary.

## Output

stdout carries one JSON report per file whenever it is piped or redirected,
and nothing when it is a terminal. stderr carries the human summary.

```json
{"file":"src/theme.css","format":"css","colors":[{"value":"#1a2b3c","notation":"hex","line":4,"column":12,"inPalette":true}],"diagnostics":[],"summary":{"colors":1,"outsidePalette":0}}
```

`inPalette` appears only when a palette was given.

## The palette

`--palette <file>` takes one colour per line, a JSON array, or a flat JSON
object's values. Comparison is by colour, so `#FFF`, `#ffffff` and
`rgb(255, 255, 255)` are one entry. A named colour is only equal to itself:
`white` in the palette does not approve `#ffffff`.

## Exit codes

- **0**: colours found, and none outside the palette.
- **1**: no colours found, or at least one outside the palette.
- **2**: the question was malformed, or `--strict` and a text file could not
  be read.

## For agents

`colors-le mcp` serves the Model Context Protocol on stdio with two tools:
`extract_colors` for a document's text and `colors_le_scan` for files and
directories. Hosts that want the server alone can install
[`colors-le-mcp`](https://www.npmjs.com/package/colors-le-mcp).

`colors-le --help` lists every option.

MIT licensed. Part of [letools](https://letools.dev/tools/colors-le).
