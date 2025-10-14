<p align="center">
  <img src="src/assets/images/icon.png" alt="Colors-LE Logo" width="96" height="96"/>
</p>
<h1 align="center">Colors-LE: Zero Hassle Color Extraction</h1>
<p align="center">
  <b>Instantly extract and analyze colors from CSS, HTML, and JavaScript with precision</b><br/>
  <i>HEX, RGB/RGBA, and HSL/HSLA color formats</i>
  <br/>
  <i>Designed for design systems, theme development, and color palette management.</i>
</p>

<p align="center">
  <!-- VS Code Marketplace -->
  <a href="https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le">
    <img src="https://img.shields.io/visual-studio-marketplace/v/nolindnaidoo.colors-le" alt="VSCode Marketplace Version" />
  </a>
  <!-- Open VSX -->
  <a href="https://open-vsx.org/extension/nolindnaidoo/colors-le">
    <img src="https://img.shields.io/open-vsx/v/nolindnaidoo/colors-le" alt="Open VSX Version" />
  </a>
  <!-- Build -->
  <a href="https://github.com/nolindnaidoo/colors-le/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/nolindnaidoo/colors-le/ci.yml?branch=main" alt="Build Status" />
  </a>
  <!-- License -->
  <a href="https://github.com/nolindnaidoo/colors-le/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/nolindnaidoo/colors-le" alt="MIT License" />
  </a>
</p>

<p align="center">
  <i>Tested on <b>Ubuntu</b>, <b>macOS</b>, and <b>Windows</b> for maximum compatibility.</i>
</p>

---

<p align="center">
  <img src="src/assets/images/demo.gif" alt="Color Extraction animation" style="max-width: 100%; height: auto;" />
  <img src="src/assets/images/command-palette.png" alt="Command Palette" style="max-width: 80%; height: auto;" />
</p>

## 🙏 Thank You!

Thank you for your interest in Colors-LE! If this extension has been helpful in managing your color extraction needs, please consider leaving a rating on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le) and [Open VSX](https://open-vsx.org/extension/nolindnaidoo/colors-le). Your feedback helps other developers discover this tool and motivates continued development.

⭐ **Interested in Colors-LE?** Star this repository to get notified when it's released!

## ✅ Why Colors-LE

**Modern web applications use colors everywhere** — CSS stylesheets, inline HTML styles, JavaScript styling, and theme configurations. Keeping track of color usage across your codebase can be challenging.

**Colors-LE makes color extraction effortless.**  
It intelligently detects and extracts colors from your code, providing comprehensive analysis and insights to help you manage color palettes effectively.

- **Complete color detection**

  Automatically finds colors in multiple formats: HEX (3/6/8-digit), RGB/RGBA, and HSL/HSLA.

- **Smart analysis & insights**

  Get detailed reports on color usage patterns, palette analysis, and color distribution across your codebase.

- **Design system support**

  Perfect for analyzing theme configurations, CSS variables, and design token usage to maintain consistent color palettes.

- **Comprehensive file format support**

  Works with CSS, HTML, JavaScript, and TypeScript files using intelligent pattern matching for reliable extraction.

- **Smart color processing**

  Preserves original color formats with optional deduplication and multi-dimensional sorting (hue, saturation, lightness, hex).

- **Multi-language support**

  English only for v1.0.0 with clean, professional interface.

## 🚀 More from the LE Family

**Colors-LE** is part of a growing family of developer tools designed to make your workflow effortless:

- **Strings-LE** - Extract every user-visible string from JSON, YAML, CSV, TOML, INI, and .env files with zero hassle  
  [[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.string-le)] [[Open VSX](https://open-vsx.org/extension/nolindnaidoo/string-le)]

- **EnvSync-LE** - Effortlessly detect, compare, and synchronize .env files across your workspace with visual diffs  
  [[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.envsync-le)] [[Open VSX](https://open-vsx.org/extension/nolindnaidoo/envsync-le)]

- **Numbers-LE** - Extract and analyze numeric data from JSON, YAML, CSV, TOML, INI, and .env  
  [[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le)] [[Open VSX](https://open-vsx.org/extension/nolindnaidoo/numbers-le)]

- **Paths-LE** - Extract and analyze file paths from imports, configs, and code  
  [[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le)] [[Open VSX](https://open-vsx.org/extension/nolindnaidoo/paths-le)]

- **Scrape-LE** - Verify page reachability and detect anti-scraping measures before deploying scrapers  
  [[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.scrape-le)]

- **Dates-LE** - Extract and analyze dates from logs, APIs, and temporal data  
  [[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.dates-le)] [[Open VSX](https://open-vsx.org/extension/nolindnaidoo/dates-le)]

- **URLs-LE** - Extract and analyze URLs from web content, APIs, and resources  
  [[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.urls-le)] [[Open VSX](https://open-vsx.org/extension/nolindnaidoo/urls-le)]

Each tool follows the same philosophy: **Zero Hassle, Maximum Productivity**.

## 💡 Use Cases

### Extract CSS Colors

Get all colors from your stylesheets:

```css
/* styles.css */
:root {
  --primary: #3b82f6;
  --secondary: #64748b;
  background: rgba(255, 255, 255, 0.9);
}
```

### Extract Inline HTML Colors

Find colors in HTML style attributes and style tags:

```html
<div style="background-color: #3b82f6; color: white;">
  <span style="border: 1px solid rgb(100, 116, 139);">Text</span>
</div>
```

### Extract JavaScript/TypeScript Colors

Identify colors in styled components and JS styling:

```javascript
const Button = styled.button`
  background-color: #3b82f6;
  color: ${(props) => (props.light ? '#ffffff' : '#000000')};
`
```

## 🚀 Quick Start

1. Open a CSS, HTML, JavaScript, or TypeScript file
2. Run **Extract Colors** command (`Cmd+Alt+C` / `Ctrl+Alt+C`)
3. Colors appear in original format, one per line

> 💡 **First time?** Try the sample files in `sample/` directory to see Colors-LE in action!

## ⚙️ Configuration

Colors-LE has **13 essential settings** — no bloat, no complexity.

### Core Settings

- `colors-le.copyToClipboardEnabled` – Auto-copy results to clipboard
- `colors-le.dedupeEnabled` – Remove duplicate colors
- `colors-le.sortEnabled` – Enable sorting
- `colors-le.sortMode` – Sort by hue, saturation, lightness, or hex
- `colors-le.openResultsSideBySide` – Open results beside current file

### Safety Settings

- `colors-le.safety.enabled` – Enable safety warnings
- `colors-le.safety.fileSizeWarnBytes` – Warn for large files (default 1MB)
- `colors-le.safety.largeOutputLinesThreshold` – Warn for many results
- `colors-le.safety.manyDocumentsThreshold` – Warn when processing many files

### UI Settings

- `colors-le.notificationsLevel` – Control notification frequency (silent/important/all)
- `colors-le.statusBar.enabled` – Show status bar item
- `colors-le.showParseErrors` – Display parsing errors
- `colors-le.telemetryEnabled` – Enable local logging

## 🌍 Language Support

**English only** for v1.0.0. Additional languages may be added in future releases based on user feedback.

## 🧩 System Requirements

- **VS Code**: 1.70.0 or higher
- **Node.js**: Not required (extension runs in VS Code's built-in runtime)
- **Platform**: Windows, macOS, Linux
- **Memory**: 50MB minimum, 200MB recommended for large files
- **Storage**: 15MB for extension files

## 🧩 Compatibility

- Works in standard workspaces
- Limited support in virtual/untrusted workspaces

## 🔒 Privacy & Telemetry

- Runs locally; no data is sent off your machine.
- Optional local-only logs can be enabled with `colors-le.telemetryEnabled`.

## ⚡ Performance

Tested on real-world files with M1 Mac and Intel i7:

| Format         | Throughput       | File Size Range | Notes                  |
| -------------- | ---------------- | --------------- | ---------------------- |
| **CSS**        | 2M+ colors/sec   | 1KB - 50MB      | Stylesheets, themes    |
| **HTML**       | 1.5M+ colors/sec | 1KB - 25MB      | Web pages, templates   |
| **JavaScript** | 1.2M+ colors/sec | 1KB - 30MB      | JavaScript, React, Vue |
| **TypeScript** | 1.2M+ colors/sec | 1KB - 30MB      | TypeScript, TSX        |

### Performance Notes

- **Memory Usage**: ~50MB base + minimal overhead per color
- **Large Files**: Files over 10MB get a safety warning (configurable)
- **No Caching**: Direct extraction, no cache complexity

## 🔧 Troubleshooting

### Common Issues

**Extension not detecting colors**

- Ensure file is saved with supported extension: `.css`, `.html`, `.htm`, `.js`, `.jsx`, `.ts`, `.tsx`
- Try reloading VS Code window (`Ctrl/Cmd + Shift + P` → "Developer: Reload Window")

**Performance issues with large files**

- Files over 1MB show a safety warning (configurable)
- Disable deduplication and sorting for faster extraction

**Colors not appearing in results**

- Verify the color format is valid (HEX, RGB, RGBA, HSL, HSLA)
- Check Output panel → "Colors-LE" for parse errors (if `showParseErrors` is enabled)

### Getting Help

- Check the [Issues](https://github.com/nolindnaidoo/colors-le/issues) page
- Enable telemetry logging: `colors-le.telemetryEnabled: true`
- Review logs in Output panel → "Colors-LE"

## ❓ FAQ

**Q: What file types are supported?**  
A: CSS, HTML, JavaScript, and TypeScript — where web colors actually live.

**Q: Can I convert colors between formats?**  
A: No. Colors-LE shows colors in their original format for maximum reliability.

**Q: Does it work with SCSS, SASS, LESS, Stylus?**  
A: No. These preprocessor formats compile to CSS. Extract from the compiled CSS instead.

**Q: What about JSON or YAML color configs?**  
A: No. These formats don't reliably indicate whether a string is a color vs. other data.

**Q: Can I analyze color accessibility?**  
A: No. Colors-LE focuses on extraction only. Use dedicated accessibility tools for analysis.

**Q: What's the largest file size supported?**  
A: Files over 1MB show a warning, but extraction still works. Very large files (>50MB) may be slow.

## 📊 Test Coverage

- 92 passing tests across 6 test suites with 55% overall coverage
- Core extraction logic has 89% coverage with comprehensive format testing
- Tests powered by Vitest with V8 coverage
- Runs quickly and locally: `bun run test` or `bun run test:coverage`
- Coverage reports output to `coverage/` (HTML summary at `coverage/index.html`)

---

Copyright © 2025
<a href="https://github.com/nolindnaidoo">@nolindnaidoo</a>. All rights reserved.
