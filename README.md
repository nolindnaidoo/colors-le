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
  <a href="https://letools.dev">
    <img src="https://img.shields.io/badge/LE%20Tools-letools.dev-blue?style=for-the-badge" alt="LE Tools" />
  </a>
</p>

---

<p align="center">
  <img src="src/assets/images/demo.gif" alt="Colors-LE Demo" style="max-width: 100%; height: auto;" />
</p>

## What it does

Open a file, press `Ctrl+Alt+C` (`Cmd+Alt+C` on Mac), and every color in the document lands in a new editor — deduplicate, sort, convert, filter, analyze, or validate it from there. Works in VS Code and in VS Code–based editors like Cursor and VSCodium (installable from Open VSX).

- **Palette auditing** — every hex, rgb()/rgba(), hsl()/hsla(), and named color in stylesheets, markup, and code
- **Design-system review** — analyze distribution, cluster similar colors, spot near-duplicates
- **Accessibility checks** — contrast ratios against WCAG AA/AAA via the Validate command

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

The settings UI is translated into 12 languages besides English.

## Privacy & security

- **No network access.** The extension never sends data anywhere. The `telemetryEnabled` setting only writes events to a local Output Channel you can inspect (`Colors-LE Telemetry`).
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

## More from the LE Family

Every tool in the family, one page: **[letools.dev](https://letools.dev)**

- **[String-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.string-le)** - Extract string values for i18n from JSON, YAML, CSV, TOML, INI, and .env
- **[Paths-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le)** - Extract file paths from JS/TS imports, JSON, HTML, CSS, TOML, CSV, and .env
- **[Numbers-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le)** - Extract numeric values from JSON, YAML, CSV, TOML, INI, and .env
- **[EnvSync-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.envsync-le)** - Spot missing keys across your .env files, with a markdown report
- **[Regex-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.regex-le)** - Find, test, and validate regular expressions with ReDoS screening
- **[Secrets-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.secrets-le)** - Detect and sanitize credentials locally, before you commit
- **[Scrape-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.scrape-le)** - Check whether a page is scrapeable before you write the scraper
- **[URLs-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.urls-le)** - Extract URLs from documentation, configs, and code
- **[Dates-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.dates-le)** - Extract and analyze dates from logs, configs, and code

## License

MIT © [nolindnaidoo](https://github.com/nolindnaidoo)
