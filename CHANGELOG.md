# Changelog

All notable changes to Colors-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-01-27

### Added

- **Multi-language support achievement** - Added comprehensive localization for 12 additional languages
- **German (de)** - Vollständige deutsche Lokalisierung für alle Benutzeroberflächen-Elemente
- **Spanish (es)** - Soporte completo en español para comandos, configuraciones y mensajes
- **French (fr)** - Localisation française complète pour l'interface utilisateur
- **Indonesian (id)** - Dukungan bahasa Indonesia lengkap untuk semua fitur
- **Italian (it)** - Localizzazione italiana completa per comandi e impostazioni
- **Japanese (ja)** - コマンド、設定、メッセージの完全な日本語サポート
- **Korean (ko)** - 모든 사용자 인터페이스 요소에 대한 완전한 한국어 지원
- **Portuguese (Brazil) (pt-br)** - Suporte completo em português brasileiro
- **Russian (ru)** - Полная локализация на русском языке для всех элементов интерфейса
- **Ukrainian (uk)** - Повна локалізація українською мовою для всіх елементів інтерфейсу
- **Vietnamese (vi)** - Hỗ trợ tiếng Việt đầy đủ cho tất cả các tính năng
- **Chinese Simplified (zh-cn)** - 简体中文完整支持，包括命令、设置和消息

### Changed

- **Internationalization infrastructure** - Implemented vscode-nls with MessageFormat.file for robust localization
- **User experience** - All commands, settings, and notifications now adapt to user's VS Code language preference
- **Documentation** - Updated README to reflect multi-language support capabilities
- **Marketplace discoverability** - Enhanced with localized descriptions and keywords

### Technical

- Created comprehensive localization files for 12 languages with 46+ translated strings each
- Implemented proper i18n patterns following VS Code extension best practices
- All existing functionality works seamlessly across all supported languages
- Maintained 100% backward compatibility with English-only installations
- Localization covers: commands, settings, notifications, error messages, and help content

## [1.2.0] - 2025-10-14

### Added

- **File type parity achievement** - Added support for SVG (Scalable Vector Graphics) files
- **SVG file support** - Extract colors from SVG icons, illustrations, and graphics
- **Comprehensive SVG parsing** - Supports fill, stroke, stop-color, flood-color, lighting-color attributes
- **Style extraction** - Parses inline styles and `<style>` sections within SVG
- **Gradient support** - Extracts colors from linear and radial gradients
- **Sample file** - Added icon.svg example demonstrating various SVG color formats

### Changed

- **Activation events** - Added `onLanguage:xml` for SVG file recognition
- **Context menus** - Extended to support .svg file extensions
- **Documentation** - Updated README and COMMANDS.md with SVG support
- **Keywords** - Added "svg", "icons", "vector" for marketplace discoverability

### Technical

- Created SVG parser with intelligent pattern matching for XML-based color extraction
- All existing commands (extract, dedupe, sort, help) work seamlessly with SVG files
- Supports all color formats: hex, rgb, rgba, hsl, hsla, and named colors
- Maintained 100% backward compatibility with existing functionality

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
