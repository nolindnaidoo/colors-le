<p align="center">
  <img src="src/assets/images/icon.png" alt="Colors-LE Logo" width="96" height="96"/>
</p>
<h1 align="center">Colors-LE: Zero Hassle Color Extraction</h1>
<p align="center">
  <b>Pull every color out of the current file in one keystroke</b><br/>
  <i>CSS, SCSS, LESS, Stylus, HTML, JavaScript, TypeScript, and SVG</i>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le">
    <img src="https://img.shields.io/badge/Install%20from-VS%20Code-blue?style=for-the-badge&logo=visualstudiocode" alt="Install from VS Code Marketplace" />
  </a>
  <a href="https://open-vsx.org/extension/OffensiveEdge/colors-le">
    <img src="https://img.shields.io/open-vsx/dt/OffensiveEdge/colors-le?style=for-the-badge&label=Open%20VSX&color=blue" alt="Open VSX downloads" />
  </a>
  <a href="https://www.npmjs.com/package/colors-le-mcp">
    <img src="https://img.shields.io/npm/v/colors-le-mcp?style=for-the-badge&label=MCP%20server&color=blue&logo=npm" alt="colors-le-mcp on npm" />
  </a>
  <a href="https://letools.dev/tools/colors-le">
    <img src="https://img.shields.io/badge/LE%20Tools-letools.dev-blue?style=for-the-badge" alt="LE Tools" />
  </a>
</p>

---

<p align="center">
  <img src="src/assets/images/demo.gif" alt="Colors-LE Demo" style="max-width: 100%; height: auto;" />
</p>

> **Useful?** A star or rating is how other developers find it —
> [★ GitHub](https://github.com/nolindnaidoo/colors-le) ·
> [★ Open VSX](https://open-vsx.org/extension/OffensiveEdge/colors-le/reviews) ·
> [★ Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le&ssr=false#review-details)

## What it does

Open a file, press `Ctrl+Alt+C` (`Cmd+Alt+C` on Mac), and every color in the document lands in a new editor — deduplicate, sort, convert, filter, analyze, or validate it from there. Works in VS Code and in VS Code–based editors like Cursor and VSCodium (installable from Open VSX).

- **Palette auditing** — every hex, rgb()/rgba(), hsl()/hsla(), and named color in stylesheets, markup, and code
- **Design-system review** — analyze distribution, cluster similar colors, spot near-duplicates
- **Accessibility checks** — contrast ratios against WCAG AA/AAA via the Validate command

## Use it from an AI agent

The same engine runs as an [MCP](https://modelcontextprotocol.io) server, so an agent can call it directly instead of you running a command.

| Editor | How |
|---|---|
| **VS Code** 1.101+ | Nothing to install — the extension registers `extract_colors` with agent mode |
| **Zed** | [Colors-LE](https://github.com/zed-industries/extensions/pull/7078) — *pending review* |
| **Claude Code** | `claude mcp add colors-le -- npx -y colors-le-mcp` |
| **Cursor, Windsurf, anything else** | point it at `npx colors-le-mcp` |

```
extract_colors(content, format?, filename?, dedupe?, maxResults?)
```

Returns every color with its notation and 1-based line and column, capped at 500 by default with `meta.truncated` so a large stylesheet cannot flood the agent's context window.

The server takes content and returns data — it reads no files and makes no network requests of its own. Published as [`colors-le-mcp`](https://www.npmjs.com/package/colors-le-mcp) on npm and as `io.github.nolindnaidoo/colors-le` in the [MCP registry](https://registry.modelcontextprotocol.io).

<details>
<summary><b>Configuring it by hand</b> — any host with an MCP config file</summary>

Most hosts read a JSON config. Add one entry:

```json
{
  "mcpServers": {
    "colors-le": {
      "command": "npx",
      "args": ["-y", "colors-le-mcp"]
    }
  }
}
```

`-y` skips the install prompt on first run. Pin a version if you would rather not track releases — `colors-le-mcp@2.2.1`.

Prefer not to go through `npx` on every launch? Install it once and point at the binary instead:

```bash
npm install -g colors-le-mcp
```

```json
{
  "mcpServers": {
    "colors-le": { "command": "colors-le-mcp" }
  }
}
```

It speaks MCP over stdio and needs no environment variables, no API key and no configuration of its own. To check it before wiring it into anything:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx -y colors-le-mcp
```

That prints the tool list and exits — if you see `extract_colors`, the server works.

</details>

## Supported formats

| Format | Language IDs | Where colors are recognized |
|---|---|---|
| CSS | `css` | Hex/functional literals anywhere outside comments; named colors in declaration values |
| SCSS / LESS / Stylus | `scss`, `less`, `stylus` | Same as CSS, plus `//` line comments respected; Stylus `=` assignments count as values |
| HTML | `html` | `style="…"` attributes, `<style>` blocks, `color`/`bgcolor` attributes |
| JavaScript / TypeScript | `javascript`, `javascriptreact`, `typescript`, `typescriptreact` | Inside string and template literals (theme objects, styled-components); named colors only when the whole string is the color |
| SVG | `xml` | `fill`, `stroke`, `stop-color`, `flood-color`, `lighting-color`, `color` attributes, plus style attributes/blocks |

Recognized syntax: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, comma-form `rgb()/rgba()/hsl()/hsla()` (calls may span multiple lines), and the CSS named colors including `rebeccapurple` and `transparent`. Positions are real 1-based line/column of each literal. Comments never produce colors, and comment markers inside strings don't start comments.

Known limitations (documented, not bugs): modern space-separated syntax (`rgb(255 0 0 / 50%)`) and `lab()`/`lch()`/`oklch()`/`color()` are not extracted; a hex inside any JS string matches, including URL fragments; Stylus values without `:` or `=` only yield hex/functional literals, not named colors.

## The CLI

The same extraction runs from a terminal or a CI step: a Rust CLI in
[`crate/`](crate/README.md), sharing one corpus with the extension —
[`crate/fixtures/`](crate/fixtures/) — so the two can never read a
document differently.

```bash
colors-le .                              # every colour in the tree
colors-le --palette brand.txt .          # what is not in the palette
colors-le --values --dedupe . | sort -u  # write the palette in the first place
colors-le mcp                            # the same extraction over MCP on stdio
```

**Matched by colour, not by spelling.** A palette written in hex still
catches a violation written in `rgb()`, because `#FFF`, `#ffffff` and
`rgb(255, 255, 255)` are one entry. Alpha is part of the identity, and a
named colour is only equal to itself — `white` and `#ffffff` are the same
pixel and not the same decision.

**Only extraction is ported.** Convert, analyze and validate are
interactive and stay in the editor, which is also what this extension's
own MCP tool says by offering extraction alone.

Exit codes: 0 clean, 1 none found or a colour outside the palette, 2 the
question was malformed.

Install it with `cargo install colors-le` once it is published; until
then it builds from `crate/`. The spec
([`crate/SPEC.md`](crate/SPEC.md)) and the engineering standard
([`crate/AGENTS.md`](crate/AGENTS.md)) live alongside it, and it keeps
its own [CHANGELOG](crate/CHANGELOG.md).

**Two MCP servers, one tool.** `colors-le mcp` offers `extract_colors`
exactly as [`colors-le-mcp`](https://www.npmjs.com/package/colors-le-mcp)
does — [`crate/fixtures/mcp-extract-colors.json`](crate/fixtures/mcp-extract-colors.json)
runs against both and CI fails if they diverge.

## Commands

| Command | Description |
|---|---|
| `Colors-LE: Extract Colors` (`Ctrl+Alt+C` / `Cmd+Alt+C`) | Extract all colors from the active document |
| `Colors-LE: Analyze Colors` | Statistics, clusters, patterns, and palette report |
| `Colors-LE: Convert Colors` | Convert extracted colors to hex/rgb/hsl |
| `Colors-LE: Filter Colors` | Filter by format, lightness, saturation |
| `Colors-LE: Validate Colors` | Format validation and WCAG contrast checks |
| `Colors-LE: Deduplicate Colors` | Remove duplicate lines from the results |
| `Colors-LE: Sort Colors` | Sort results by the configured `sortMode` |
| `Colors-LE: Open Settings` | Open Colors-LE settings |
| `Colors-LE: Help` | Built-in documentation |

## Settings

| Setting | Default | Description |
|---|---|---|
| `colors-le.openResultsSideBySide` | `true` | Open results beside the current editor (off = replace in place) |
| `colors-le.copyToClipboardEnabled` | `false` | Also copy results to the clipboard |
| `colors-le.dedupeEnabled` | `false` | Deduplicate extraction results automatically |
| `colors-le.sortMode` | `off` | Sort order used by the Sort command (hue/saturation/lightness/hex, asc/desc) |
| `colors-le.notificationsLevel` | `silent` | `all` = every notification, `important` = warnings + errors, `silent` = errors only |
| `colors-le.safety.enabled` | `true` | Guardrails for very large files |
| `colors-le.safety.fileSizeWarnBytes` | `1000000` | Refuse extraction above this file size (override prompt offered) |
| `colors-le.safety.largeOutputLinesThreshold` | `50000` | Warn above this line count |
| `colors-le.statusBar.enabled` | `true` | Show the status bar item |
| `colors-le.telemetryEnabled` | `false` | Local-only event log (see Privacy) |

## Languages

Twelve languages besides English:

German · Spanish · French · Indonesian · Italian · Japanese · Korean ·
Portuguese (Brazil) · Russian · Ukrainian · Vietnamese · Chinese (Simplified)

Both halves are covered — the manifest (command titles, setting names and
descriptions) and everything shown while the extension runs (notifications,
the status bar, quick-picks and prompts). The extension follows VS Code's
display language, so it matches whatever the editor is already set to; no
setting of its own.

## Privacy & security

- **No network access.** The extension never sends data anywhere. The `telemetryEnabled` setting only writes events to a local Output Channel you can inspect (`Colors-LE Telemetry`).
- **The MCP server holds the same line.** It takes content as an argument and returns data: no filesystem access, no network calls, no telemetry. Your agent already has file-read tools, so duplicating them inside the server would add a path-traversal surface for no capability. `check:mcp-bundle` fails the build if the server ever imports something that could reach either.
- Error notifications redact home directories and credential-shaped fragments.

## Development

```bash
bun install
bun run build            # esbuild bundle -> dist/extension.js
bun run typecheck        # tsc --noEmit (includes tests)
bun run test             # vitest unit suite
bun run test:integration # real VS Code extension host
bun run lint             # biome
bun run package          # VSIX into release/
```

Architecture and conventions live in [AGENTS.md](AGENTS.md). Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Performance

<!-- performance:start -->
| Input | Size | Found | Time | Rate | Scan speed |
| --- | --- | --- | --- | --- | --- |
| CSS stylesheet | 1.58 MB | 60,000 | 57.25 ms | 1,048,075/sec | 27.7 MB/s |
| SCSS variables | 1.96 MB | 60,000 | 67.02 ms | 895,249/sec | 29.3 MB/s |
| HTML markup | 1.29 MB | 50,000 | 33.72 ms | 1,482,680/sec | 38.2 MB/s |

Median of 7 runs after warmup, on Apple M5 Pro, 24 GB RAM, Node 24.3.0. Inputs are generated
by `scripts/benchmark.ts` rather than checked in, so the sizes above are
exactly what was measured. Reproduce with `bun run benchmark`.

These are machine-specific and are not asserted in CI — a benchmark that gates
a build only tells you how busy the runner was.
<!-- performance:end -->

## Testing

<!-- coverage:start -->
| Metric | Coverage |
| --- | --- |
| Statements | 90.78% |
| Branches | 79.11% |
| Functions | 95.36% |
| Lines | 92.10% |

322 test cases across 22 files, plus an integration suite that runs
in a real VS Code extension host and an end-to-end test that installs the
built `.vsix` into a clean profile.

Generated from `coverage/coverage-summary.json` by
`scripts/coverage-readme.js`; CI fails if this section drifts from a fresh
run. Reproduce with `bun run test:coverage`.
<!-- coverage:end -->

## More from the LE Family

Every tool in the family, one page: **[letools.dev](https://letools.dev)**

All ten also ship as MCP servers — `npx <name>-mcp` gives any agent the same engine. Nine go further and ship a Rust CLI: **Paths-LE**, **Secrets-LE**, **URLs-LE**, **Regex-LE**, **String-LE**, **Numbers-LE**, **EnvSync-LE**, **Colors-LE** and **Scrape-LE**, each installed with `cargo install <that-name>`.

- **[String-LE](https://letools.dev/tools/string-le)** - Extract string values for i18n from JSON, YAML, CSV, TOML, INI, and .env
- **[Paths-LE](https://letools.dev/tools/paths-le)** - Extract file paths from JS/TS imports, JSON, HTML, CSS, TOML, CSV, and .env
- **[Numbers-LE](https://letools.dev/tools/numbers-le)** - Extract numeric values from JSON, YAML, CSV, TOML, INI, and .env
- **[EnvSync-LE](https://letools.dev/tools/envsync-le)** - Spot missing keys across your .env files, with a markdown report
- **[Regex-LE](https://letools.dev/tools/regex-le)** - Find, test, and validate regular expressions with ReDoS screening
- **[Secrets-LE](https://letools.dev/tools/secrets-le)** - Detect and sanitize credentials locally, before you commit
- **[Scrape-LE](https://letools.dev/tools/scrape-le)** - Check whether a page is scrapeable before you write the scraper
- **[URLs-LE](https://letools.dev/tools/urls-le)** - Extract URLs from documentation, configs, and code
- **[Dates-LE](https://letools.dev/tools/dates-le)** - Extract and analyze dates from logs, configs, and code

## Also by nolindnaidoo

**Rust** — pixelcoords and pixelactions are one loop: pixelcoords answers *where*, pixelactions *acts* there. The nine LE crates are the terminal half of the extensions they sit in — the same detection, held to the extension's own corpus, and an exit code instead of a results editor.

- **[pixelcoords](https://github.com/nolindnaidoo/pixelcoords)** — Freeze your screen, mark regions, get pixel-exact coordinates and crops
  [pixelcoords.dev](https://pixelcoords.dev) · [crates.io](https://crates.io/crates/pixelcoords) · [docs.rs](https://docs.rs/pixelcoords)
- **[pixelactions](https://github.com/nolindnaidoo/pixelactions)** — Consume human-verified coordinates, perform the interaction, confirm it landed
  [pixelactions.dev](https://pixelactions.dev) · [crates.io](https://crates.io/crates/pixelactions) · [docs.rs](https://docs.rs/pixelactions)
- **[colors-le](https://github.com/nolindnaidoo/colors-le/tree/main/crate)** — This extension's own CLI: find every colour in a codebase, and say which are not in your palette
  [crates.io](https://crates.io/crates/colors-le)
- **[paths-le](https://github.com/nolindnaidoo/paths-le/tree/main/crate)** — Find every path in a codebase and report whether it still points at anything
  [crates.io](https://crates.io/crates/paths-le)
- **[secrets-le](https://github.com/nolindnaidoo/secrets-le/tree/main/crate)** — Find hardcoded credentials, and never print one
  [crates.io](https://crates.io/crates/secrets-le)
- **[urls-le](https://github.com/nolindnaidoo/urls-le/tree/main/crate)** — Extract every URL from a codebase, with its protocol and exact position
  [crates.io](https://crates.io/crates/urls-le)
- **[regex-le](https://github.com/nolindnaidoo/regex-le/tree/main/crate)** — Find every regex in a codebase and report which can be driven into catastrophic backtracking
  [crates.io](https://crates.io/crates/regex-le)
- **[string-le](https://github.com/nolindnaidoo/string-le/tree/main/crate)** — Get every string in a codebase out where a person can read them
  [crates.io](https://crates.io/crates/string-le)
- **[numbers-le](https://github.com/nolindnaidoo/numbers-le/tree/main/crate)** — Find every hardcoded number in a codebase so a person can check them
  [crates.io](https://crates.io/crates/numbers-le)
- **[envsync-le](https://github.com/nolindnaidoo/envsync-le/tree/main/crate)** — Compare the dotenv files in a tree and say which keys are missing from which
  [crates.io](https://crates.io/crates/envsync-le)
- **[scrape-le](https://github.com/nolindnaidoo/scrape-le/tree/main/crate)** — Check whether a page is scrapeable before the scraper is written
  [crates.io](https://crates.io/crates/scrape-le)

**Contact Developer** — [nolindnaidoo.com](https://nolindnaidoo.com) · [GitHub](https://github.com/nolindnaidoo) · [LinkedIn](https://www.linkedin.com/in/nolindnaidoo/)

## License

MIT © [nolindnaidoo](https://github.com/nolindnaidoo)
