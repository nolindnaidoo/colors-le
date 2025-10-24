# Colors-LE Commands

All available commands in the Colors-LE VS Code extension.

## Core Commands

### Extract Colors

**Command ID**: `colors-le.extractColors`  
**Keyboard**: `Ctrl+Alt+C` (`Cmd+Alt+C` on macOS)  
**Context Menu**: Right-click in editor → "Extract Colors"

Extracts all colors from the active document.

**Supported Files**:

- CSS (`.css`)
- HTML (`.html`, `.htm`)
- JavaScript (`.js`, `.jsx`)
- TypeScript (`.ts`, `.tsx`)

**Supported Formats**:

- HEX: `#fff`, `#ffffff`, `#ffffffaa`
- RGB/RGBA: `rgb(255, 255, 255)`, `rgba(255, 255, 255, 0.5)`
- HSL/HSLA: `hsl(0, 0%, 100%)`, `hsla(0, 0%, 100%, 0.5)`
- Named: CSS named colors (`red`, `blue`, etc.)

**Output**: Colors appear in original format, one per line.

---

### Deduplicate Colors

**Command ID**: `colors-le.postProcess.dedupe`

Removes duplicate colors from extracted results.

**Usage**: Run after extracting colors to see unique values only.

---

### Sort Colors

**Command ID**: `colors-le.postProcess.sort`

Sorts extracted colors by various criteria.

**Sort Modes**:

- `off` - No sorting (default)
- `hue-asc` / `hue-desc` - By hue (rainbow order)
- `saturation-asc` / `saturation-desc` - By saturation
- `lightness-asc` / `lightness-desc` - By lightness (dark to light)
- `hex-asc` / `hex-desc` - By hex value (alphabetical)

**Usage**: Configure `colors-le.sortMode` in settings or run command on extracted colors.

---

## Utility Commands

### Help

**Command ID**: `colors-le.help`

Opens the Colors-LE documentation in your browser.

---

### Open Settings

**Command ID**: `colors-le.openSettings`

Opens the Colors-LE settings panel.

---

## Command Palette

All commands are available via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

1. Search for "Colors-LE"
2. Select the desired command
3. Follow any prompts

## Context Menu

The **Extract Colors** command is available in the editor context menu when you right-click in:

- CSS files
- HTML files
- JavaScript/JSX files
- TypeScript/TSX files

## Keyboard Shortcuts

| Command        | Windows/Linux | macOS       |
| -------------- | ------------- | ----------- |
| Extract Colors | `Ctrl+Alt+C`  | `Cmd+Alt+C` |

All other commands are available via Command Palette only.
