# Colors-LE VS Code Extension - Technical Specification

## Overview

Colors-LE is a VS Code extension for extracting, analyzing, and managing colors from various file formats. This document defines the architecture, patterns, and implementation details specific to this codebase.

## Design goals and constraints

- Fast, reliable color extraction for large files with predictable UX
- Minimal activation; core logic is pure and testable
- Immutable data flows; configuration and results are frozen
- Clear safety model for heavy operations with user choice
- Internationalization by default; accessibility-friendly feedback
- No network access; privacy-first operation
- WCAG compliance and accessibility analysis

Non-goals:

- Rich color editing or palette generation (focus is extraction and analysis)
- Persisting project state or remote telemetry
- Real-time color preview or live editing

## Architecture

See `ARCHITECTURE.md` for visuals (flow, sequence, and dependency diagrams) and component responsibilities.

### Design Patterns

#### Factory Pattern

All major components use factory functions returning frozen interfaces:

```typescript
// Factory functions return immutable interfaces
export function createStatusBar(context: vscode.ExtensionContext): StatusBar
export function createTelemetry(): Telemetry
export function createNotifier(): Notifier

// Interfaces define contracts
export interface StatusBar {
  flash(text: string): void
}
```

#### Dependency Injection

Commands receive dependencies as parameter objects:

```typescript
export function registerAllCommands(
  context: vscode.ExtensionContext,
  deps: Readonly<{
    telemetry: Telemetry
    notifier: Notifier
    statusBar: StatusBar
  }>,
): void
```

#### Router Pattern

The extraction engine uses a lookup table for format handlers:

```typescript
const EXTRACTORS: Readonly<Record<string, Extractor>> = Object.freeze({
  css: extractCss,
  scss: extractScss,
  javascript: extractJavaScript,
  // ...
})
```

#### Immutable Data

All data structures are frozen to prevent mutation:

```typescript
export type ExtractorOptions = Readonly<{
  onParseError?: (message: string) => void
  includeComments?: boolean
}>

export type Extractor = (text: string, options?: ExtractorOptions) => readonly Color[]
```

## Core Types

### Color Representation

```typescript
export type Color = Readonly<{
  value: string
  format: ColorFormat
  position: Readonly<{
    line: number
    column: number
  }>
  context?: string
}>

export type ColorFormat = 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'named'
```

### Analysis Results

```typescript
export type AnalysisResult = Readonly<{
  accessibility: AccessibilityAnalysis
  contrast: ContrastAnalysis
  palette: PaletteAnalysis
}>

export type AccessibilityAnalysis = Readonly<{
  wcagAA: Readonly<Color[]>
  wcagAAA: Readonly<Color[]>
  issues: Readonly<AccessibilityIssue[]>
}>

export type ContrastAnalysis = Readonly<{
  pairs: Readonly<ComplementaryPair[]>
  averageContrast: number
  minContrast: number
  maxContrast: number
}>
```

## Functional Requirements

### Core Features

#### 1. Color Extraction

- **Requirement**: Extract colors from various file formats
- **Formats**: CSS, SCSS, JavaScript, JSON, YAML, HTML
- **Color Formats**: Hex, RGB, RGBA, HSL, HSLA, named colors
- **Context**: Preserve line/column position and surrounding context
- **Error Handling**: Graceful handling of malformed color values

#### 2. Color Analysis

- **Requirement**: Analyze extracted colors for accessibility and usability
- **Contrast Analysis**: Calculate contrast ratios between color pairs
- **WCAG Compliance**: Check against WCAG AA and AAA standards
- **Palette Analysis**: Identify color relationships and patterns
- **Accessibility Issues**: Flag problematic color combinations

#### 3. Color Conversion

- **Requirement**: Convert between different color formats
- **Supported Formats**: Hex ↔ RGB ↔ HSL ↔ Named colors
- **Validation**: Ensure color values are within valid ranges
- **Precision**: Maintain color accuracy during conversion

#### 4. Post-Processing

- **Requirement**: Process extracted colors for better usability
- **Deduplication**: Remove duplicate colors
- **Sorting**: Sort by various criteria (hue, saturation, lightness, name)
- **Filtering**: Filter by format, accessibility, or other criteria

### Safety Features

#### 1. File Size Limits

- **Requirement**: Prevent processing of extremely large files
- **Default Limit**: 1MB file size warning
- **User Override**: Allow users to proceed with confirmation
- **Performance**: Stream processing for large files

#### 2. Output Size Limits

- **Requirement**: Prevent overwhelming output
- **Default Limit**: 10,000 colors warning
- **User Options**: Open in editor, copy to clipboard, or cancel
- **Progressive Disclosure**: Show summary first, details on demand

#### 3. Memory Management

- **Requirement**: Efficient memory usage
- **Immutable Data**: Prevent memory leaks
- **Cleanup**: Dispose of resources properly
- **Monitoring**: Track memory usage

## Non-Functional Requirements

### Performance

- **Response Time**: Extract colors from 50KB file in <100ms
- **Memory Usage**: <50MB for typical operations
- **Scalability**: Handle files up to 10MB
- **Concurrency**: Support multiple simultaneous operations

### Reliability

- **Error Rate**: <1% failure rate for valid inputs
- **Recovery**: Graceful degradation on errors
- **Consistency**: Deterministic results for same input
- **Stability**: No crashes or memory leaks

### Usability

- **Accessibility**: WCAG AA compliance
- **Internationalization**: Support for multiple languages
- **Feedback**: Clear progress indicators and error messages
- **Documentation**: Comprehensive help and examples

### Security

- **Input Validation**: Validate all user inputs
- **File Access**: Respect workspace trust boundaries
- **Data Privacy**: No external data transmission
- **Error Handling**: Sanitize error messages

## Implementation Details

### Color Parsing

```typescript
export function parseColor(colorString: string): Color | null {
  // Try different formats in order of specificity
  if (isHexColor(colorString)) {
    return parseHexColor(colorString)
  }
  if (isRgbColor(colorString)) {
    return parseRgbColor(colorString)
  }
  if (isHslColor(colorString)) {
    return parseHslColor(colorString)
  }
  if (isNamedColor(colorString)) {
    return parseNamedColor(colorString)
  }
  return null
}
```

### Contrast Calculation

```typescript
export function calculateContrast(color1: Color, color2: Color): number {
  const rgb1 = colorToRgb(color1)
  const rgb2 = colorToRgb(color2)
  const lum1 = calculateLuminance(rgb1)
  const lum2 = calculateLuminance(rgb2)
  return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05)
}
```

### Error Handling

```typescript
export type ParseError = Readonly<{
  message: string
  position: Readonly<{
    line: number
    column: number
  }>
  context?: string
  severity: 'warning' | 'error'
}>

export function handleParseError(error: ParseError, config: Configuration): void {
  if (config.showParseErrors) {
    telemetry.logError('parse_error', error)
  }
  // Continue processing with safe defaults
}
```

## Configuration Schema

```typescript
export type ColorsLeConfig = Readonly<{
  extraction: Readonly<{
    includeComments: boolean
    includeNamedColors: boolean
    includeTransparent: boolean
  }>
  analysis: Readonly<{
    wcagLevel: 'AA' | 'AAA'
    contrastThreshold: number
    includePaletteAnalysis: boolean
  }>
  output: Readonly<{
    format: 'hex' | 'rgb' | 'hsl' | 'named'
    includePosition: boolean
    includeContext: boolean
  }>
  safety: Readonly<{
    enabled: boolean
    fileSizeWarnBytes: number
    maxColorsThreshold: number
    processingTimeWarnMs: number
  }>
  notificationsLevel: 'all' | 'important' | 'silent'
  showParseErrors: boolean
  telemetryEnabled: boolean
}>
```

## Testing Strategy

### Unit Tests

- **Color Parsing**: Test all color format parsers
- **Conversion Logic**: Test color format conversions
- **Analysis Functions**: Test contrast and accessibility calculations
- **Utility Functions**: Test helper functions

### Integration Tests

- **Extraction Pipeline**: Test complete extraction flow
- **Command Execution**: Test VS Code command integration
- **Error Scenarios**: Test error handling and recovery
- **Performance**: Test with large files

### Test Data

- **Fixtures**: Real CSS/SCSS files with known colors
- **Edge Cases**: Malformed colors, boundary values
- **Performance**: Large files, many colors
- **Accessibility**: Colors with known contrast ratios

## Security Considerations

### Input Validation

- **File Type**: Validate file extensions and content
- **Color Values**: Validate color format and range
- **File Size**: Limit processing of large files
- **Path Validation**: Prevent path traversal attacks

### Data Privacy

- **Local Processing**: All processing happens locally
- **No Network**: No external network calls
- **Telemetry**: Optional local-only telemetry
- **User Control**: User controls all data sharing

### Error Handling

- **Sanitized Messages**: Remove sensitive information
- **Local Logging**: All errors logged locally only
- **User Control**: Users can disable error reporting

## Performance Budgets

- **Small Files (<50KB)**: End-to-end under ~100ms
- **Medium Files (50KB-1MB)**: End-to-end under ~500ms
- **Large Files (1MB-10MB)**: End-to-end under ~2s
- **Memory Usage**: <50MB for typical operations
- **Color Count**: Handle up to 10,000 colors efficiently

## Accessibility Requirements

### WCAG Compliance

- **Level AA**: Minimum contrast ratio of 4.5:1 for normal text
- **Level AAA**: Minimum contrast ratio of 7:1 for normal text
- **Large Text**: Reduced requirements for large text
- **Color Blindness**: Consider colorblind-friendly palettes

### User Interface

- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper ARIA labels and descriptions
- **High Contrast**: Support for high contrast themes
- **Focus Management**: Clear focus indicators

## Future Enhancements

### Planned Features

- **Image Analysis**: Extract colors from images
- **Palette Generation**: Generate color palettes
- **Color Harmony**: Analyze color relationships
- **Export Formats**: Multiple output formats
- **Visualization**: Color palette visualization

### Architecture Evolution

- **Plugin System**: Allow third-party extractors
- **Configuration UI**: Visual settings interface
- **Performance Dashboard**: Real-time monitoring
- **Batch Processing**: Process multiple files
