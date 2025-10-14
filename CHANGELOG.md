# Changelog

All notable changes to Colors-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-10-14

### Added

- **Command parity achievement** - Full parity with other LE extraction extensions
- **Comprehensive documentation** - Added complete command list to README with examples
- **Documentation updates** - Updated all docs to reflect command parity achievement

### Changed

- **Infrastructure verification** - Verified activation events, command registry, and all infrastructure components
- **Command count** - Stabilized at 5 commands (Extract, Dedupe, Sort, Settings, Help)

### Removed

- **Broken commands** - Removed non-functional export/import/reset settings commands that were never implemented

## [1.0.1] - 2025-10-14

### Fixed

- **VSCode engine version requirement** - Changed from `^1.105.0` to `^1.70.0` for better compatibility with current VSCode versions

## [1.0.0] - 2025-10-13

### Initial Public Release

Colors-LE brings zero-hassle color extraction to VS Code. Simple, reliable, focused.

#### Supported File Types

- **CSS** - Stylesheets with all standard color formats
- **HTML** - Inline styles and style tags
- **JavaScript** - JS, JSX with styled components support
- **TypeScript** - TS, TSX with styled components support

#### Color Formats

- **HEX** - 3-digit (#fff), 6-digit (#ffffff), 8-digit with alpha (#ffffffaa)
- **RGB/RGBA** - rgb(255, 255, 255), rgba(255, 255, 255, 0.5)
- **HSL/HSLA** - hsl(0, 0%, 100%), hsla(0, 0%, 100%, 0.5)

#### Features

- **Original format output** - Shows colors exactly as they appear in your code
- **Smart deduplication** - Optional removal of duplicate colors
- **Multiple sort modes** - Sort by hue, saturation, lightness, or hex value
- **Safety warnings** - Alerts for large files (configurable thresholds)
- **Clipboard integration** - Optional auto-copy to clipboard
- **Settings management** - Import, export, and reset configuration

#### User Experience

- **One-command extraction** - `Ctrl+Alt+C` (`Cmd+Alt+C` on macOS)
- **Side-by-side results** - Open results alongside source files
- **Silent by default** - Minimal notifications, maximum focus
- **English only** - Clean, professional interface

#### Developer Experience

- **13 essential settings** - No bloat, no complexity
- **92 passing tests** - 55% overall coverage, 89% extraction coverage
- **TypeScript strict mode** - Full type safety with exactOptionalPropertyTypes
- **Functional programming** - Immutable types, pure functions
- **MIT licensed** - Open source, free to use
