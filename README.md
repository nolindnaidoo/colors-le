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
  <a href="https://crates.io/crates/colors-le">
    <img src="https://img.shields.io/crates/v/colors-le?style=for-the-badge&label=Rust%20CLI&color=blue&logo=rust" alt="colors-le on crates.io" />
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

## Install

| Where | What you get | Install |
|---|---|---|
| **VS Code** | Extraction, conversion, analysis and validation in your editor | [Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le) |
| **Cursor, VSCodium, Windsurf** | The same extension | [Open VSX](https://open-vsx.org/extension/OffensiveEdge/colors-le) |
| **A terminal or a CI step** | The same extraction over a whole tree, with exit codes | `cargo install colors-le` · [crates.io](https://crates.io/crates/colors-le) |
| **Any MCP agent, via Node** | `extract_colors` over stdio | `npx colors-le-mcp` · [npm](https://www.npmjs.com/package/colors-le-mcp) |
| **Zed** | The MCP server as a context server | [zed-industries/extensions#7078](https://github.com/zed-industries/extensions/pull/7078) *(pending review)* |

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

`-y` skips the install prompt on first run. Pin a version if you would rather not track releases — `colors-le-mcp@2.3.0`.

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
| SVG / XML | `xml`, `svg` | `fill`, `stroke`, `stop-color`, `flood-color`, `lighting-color`, `color`, `bgcolor` attributes, plus style attributes/blocks |
| JSON / YAML / TOML | `json`, `jsonc`, `yaml`, `toml` | Design tokens: literals anywhere, named colors where the value **is** the color |
| Markdown / plain text | `markdown`, `plaintext` | Same, and a 3- or 4-digit hex must contain an `a`-`f` — `#250` in prose is an issue reference |
| **Everything else** | any language id | Read as raw text under the same rules, and reported as `unknown` |

**No document is refused.** A language with no reader of its own is read as raw text, and `metadata.fileType` says which of the two answered.

Recognized syntax: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, comma-form `rgb()/rgba()/hsl()/hsla()` (calls may span multiple lines), and the CSS named colors including `rebeccapurple` and `transparent`. Positions are real 1-based line/column of each literal. Comments never produce colors, and comment markers inside strings don't start comments.

Known limitations (documented, not bugs): modern space-separated syntax (`rgb(255 0 0 / 50%)`) and `lab()`/`lch()`/`oklch()`/`color()` are not extracted; a hex inside any JS string matches, including URL fragments; Stylus values without `:` or `=` only yield hex/functional literals, not named colors; in the raw-text scan a value segment runs to the end of the line, so two tokens on one line cost the named one.

## The CLI

The same extraction from a terminal or a CI step — a Rust CLI in
[`crate/`](crate/README.md), installed with `cargo install colors-le`.
Convert, analyze and validate are interactive and stay in the editor.

```bash
colors-le .                              # every colour in the tree
colors-le --palette brand.txt .          # what is not in the palette
colors-le --values --dedupe . | sort -u  # write the palette in the first place
colors-le mcp                            # the same extraction over MCP on stdio
```

Exit codes: 0 clean, 1 none found or a colour outside the palette, 2 the
question was malformed.

**Matched by colour, not by spelling.** A palette written in hex still
catches a violation written in `rgb()`, because `#FFF`, `#ffffff` and
`rgb(255, 255, 255)` are one entry. Alpha is part of the identity, and a
named colour is only equal to itself — `white` and `#ffffff` are the same
pixel and not the same decision.

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

## Documentation

| What | Where |
|---|---|
| What the tool is allowed to say — extraction scope, output contract, refusals, non-goals | [`crate/SPEC.md`](crate/SPEC.md) |
| How the extension is built and held together — architecture, invariants, toolchain, release | [AGENTS.md](AGENTS.md) |
| How the CLI is built and held together | [`crate/AGENTS.md`](crate/AGENTS.md) |
| What changed | [CHANGELOG.md](CHANGELOG.md) · [`crate/CHANGELOG.md`](crate/CHANGELOG.md) |
| The tool's page, and the other fifteen | [letools.dev/tools/colors-le](https://letools.dev/tools/colors-le) |

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
| Statements | 90.79% |
| Branches | 79.43% |
| Functions | 95.48% |
| Lines | 92.13% |

347 test cases across 24 files, plus an integration suite that runs
in a real VS Code extension host and an end-to-end test that installs the
built `.vsix` into a clean profile.

Generated from a real run — `coverage/coverage-summary.json` and
`coverage/test-results.json` — by `scripts/coverage-readme.js`; CI fails if
this section drifts. Reproduce with `bun run test:coverage`, and the case
count is the one vitest prints.
<!-- coverage:end -->

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

MIT © [nolindnaidoo](https://github.com/nolindnaidoo)
