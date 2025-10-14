# Colors-LE Configuration

This document describes all configuration options available in the Colors-LE VS Code extension.

## Overview

Colors-LE provides comprehensive configuration options to customize color extraction, analysis, and output behavior. All settings can be configured through VS Code's settings interface or by editing the `settings.json` file.

## Configuration Categories

### Extraction Settings

Control how colors are extracted from files.

#### `colors-le.extraction.includeComments`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Include colors found in comments and documentation.

**Example**:

```json
{
  "colors-le.extraction.includeComments": true
}
```

**Use Cases**:

- `true`: Extract colors from comments like `/* Primary color: #ff6b6b */`
- `false`: Skip colors in comments, focus on actual CSS properties

#### `colors-le.extraction.includeNamedColors`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Include named colors (red, blue, etc.) in extraction.

**Example**:

```json
{
  "colors-le.extraction.includeNamedColors": true
}
```

**Use Cases**:

- `true`: Extract named colors like `color: red;`
- `false`: Skip named colors, focus on hex/rgb/hsl values

#### `colors-le.extraction.includeTransparent`

**Type**: `boolean`  
**Default**: `false`  
**Description**: Include transparent colors (alpha < 1.0) in extraction.

**Example**:

```json
{
  "colors-le.extraction.includeTransparent": false
}
```

**Use Cases**:

- `true`: Extract `rgba(255, 0, 0, 0.5)` and `hsla(0, 100%, 50%, 0.8)`
- `false`: Skip transparent colors, focus on opaque colors

### Analysis Settings

Control color analysis and accessibility checking.

#### `colors-le.analysis.wcagLevel`

**Type**: `string`  
**Default**: `"AA"`  
**Description**: WCAG compliance level for accessibility analysis.

**Options**:

- `"AA"`: WCAG AA compliance (4.5:1 contrast ratio)
- `"AAA"`: WCAG AAA compliance (7:1 contrast ratio)

**Example**:

```json
{
  "colors-le.analysis.wcagLevel": "AAA"
}
```

**Use Cases**:

- `"AA"`: Standard accessibility compliance
- `"AAA"`: Enhanced accessibility compliance

#### `colors-le.analysis.contrastThreshold`

**Type**: `number`  
**Default**: `4.5`  
**Description**: Minimum contrast ratio threshold for analysis.

**Example**:

```json
{
  "colors-le.analysis.contrastThreshold": 4.5
}
```

**Use Cases**:

- `4.5`: WCAG AA standard
- `7.0`: WCAG AAA standard
- `3.0`: Lower threshold for large text

#### `colors-le.analysis.includePaletteAnalysis`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Include color palette analysis in results.

**Example**:

```json
{
  "colors-le.analysis.includePaletteAnalysis": true
}
```

**Use Cases**:

- `true`: Analyze color relationships and harmony
- `false`: Skip palette analysis, focus on individual colors

### Output Settings

Control how extracted colors are displayed and formatted.

#### `colors-le.output.format`

**Type**: `string`  
**Default**: `"hex"`  
**Description**: Default format for displaying colors.

**Options**:

- `"hex"`: Hexadecimal format (#ff6b6b)
- `"rgb"`: RGB format (rgb(255, 107, 107))
- `"hsl"`: HSL format (hsl(0, 100%, 50%))
- `"named"`: Named color format (red)

**Example**:

```json
{
  "colors-le.output.format": "hex"
}
```

**Use Cases**:

- `"hex"`: Most common format for web development
- `"rgb"`: Useful for CSS properties
- `"hsl"`: Better for color manipulation
- `"named"`: Human-readable format

#### `colors-le.output.includePosition`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Include line and column position in output.

**Example**:

```json
{
  "colors-le.output.includePosition": true
}
```

**Use Cases**:

- `true`: Show where colors are found in the file
- `false`: Hide position information, focus on colors only

#### `colors-le.output.includeContext`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Include surrounding context for each color.

**Example**:

```json
{
  "colors-le.output.includeContext": true
}
```

**Use Cases**:

- `true`: Show CSS property or variable name
- `false`: Hide context, show colors only

### Safety Settings

Control performance and safety limits.

#### `colors-le.safety.enabled`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Enable safety checks for large files and operations.

**Example**:

```json
{
  "colors-le.safety.enabled": true
}
```

**Use Cases**:

- `true`: Warn before processing large files
- `false`: Disable safety checks, process all files

#### `colors-le.safety.fileSizeWarnBytes`

**Type**: `number`  
**Default**: `1048576` (1MB)  
**Description**: File size threshold for warning (in bytes).

**Example**:

```json
{
  "colors-le.safety.fileSizeWarnBytes": 2097152
}
```

**Use Cases**:

- `1048576`: 1MB warning threshold
- `2097152`: 2MB warning threshold
- `5242880`: 5MB warning threshold

#### `colors-le.safety.maxColorsThreshold`

**Type**: `number`  
**Default**: `10000`  
**Description**: Maximum number of colors before warning.

**Example**:

```json
{
  "colors-le.safety.maxColorsThreshold": 5000
}
```

**Use Cases**:

- `10000`: Standard threshold
- `5000`: Lower threshold for better performance
- `20000`: Higher threshold for large projects

#### `colors-le.safety.processingTimeWarnMs`

**Type**: `number`  
**Default**: `5000` (5 seconds)  
**Description**: Processing time threshold for warning (in milliseconds).

**Example**:

```json
{
  "colors-le.safety.processingTimeWarnMs": 3000
}
```

**Use Cases**:

- `5000`: 5-second warning threshold
- `3000`: 3-second warning threshold
- `10000`: 10-second warning threshold

### Notification Settings

Control user feedback and notifications.

#### `colors-le.notificationsLevel`

**Type**: `string`  
**Default**: `"important"`  
**Description**: Level of notifications to show.

**Options**:

- `"all"`: Show all notifications
- `"important"`: Show only important notifications
- `"silent"`: Show no notifications

**Example**:

```json
{
  "colors-le.notificationsLevel": "all"
}
```

**Use Cases**:

- `"all"`: Maximum feedback for debugging
- `"important"`: Balanced feedback for normal use
- `"silent"`: Minimal feedback for quiet operation

#### `colors-le.showParseErrors`

**Type**: `boolean`  
**Default**: `true`  
**Description**: Show parse errors and warnings.

**Example**:

```json
{
  "colors-le.showParseErrors": true
}
```

**Use Cases**:

- `true`: Show errors for debugging
- `false`: Hide errors, focus on successful extraction

### Telemetry Settings

Control logging and telemetry.

#### `colors-le.telemetryEnabled`

**Type**: `boolean`  
**Default**: `false`  
**Description**: Enable local-only telemetry logging.

**Example**:

```json
{
  "colors-le.telemetryEnabled": false
}
```

**Use Cases**:

- `true`: Enable logging for debugging
- `false`: Disable logging for privacy

## Configuration Examples

### Default Configuration

```json
{
  "colors-le.extraction.includeComments": true,
  "colors-le.extraction.includeNamedColors": true,
  "colors-le.extraction.includeTransparent": false,
  "colors-le.analysis.wcagLevel": "AA",
  "colors-le.analysis.contrastThreshold": 4.5,
  "colors-le.analysis.includePaletteAnalysis": true,
  "colors-le.output.format": "hex",
  "colors-le.output.includePosition": true,
  "colors-le.output.includeContext": true,
  "colors-le.safety.enabled": true,
  "colors-le.safety.fileSizeWarnBytes": 1048576,
  "colors-le.safety.maxColorsThreshold": 10000,
  "colors-le.safety.processingTimeWarnMs": 5000,
  "colors-le.notificationsLevel": "important",
  "colors-le.showParseErrors": true,
  "colors-le.telemetryEnabled": false
}
```

### Performance-Focused Configuration

```json
{
  "colors-le.extraction.includeComments": false,
  "colors-le.extraction.includeNamedColors": false,
  "colors-le.extraction.includeTransparent": false,
  "colors-le.analysis.includePaletteAnalysis": false,
  "colors-le.output.includePosition": false,
  "colors-le.output.includeContext": false,
  "colors-le.safety.enabled": true,
  "colors-le.safety.fileSizeWarnBytes": 524288,
  "colors-le.safety.maxColorsThreshold": 5000,
  "colors-le.safety.processingTimeWarnMs": 2000,
  "colors-le.notificationsLevel": "silent",
  "colors-le.showParseErrors": false,
  "colors-le.telemetryEnabled": false
}
```

### Accessibility-Focused Configuration

```json
{
  "colors-le.extraction.includeComments": true,
  "colors-le.extraction.includeNamedColors": true,
  "colors-le.extraction.includeTransparent": true,
  "colors-le.analysis.wcagLevel": "AAA",
  "colors-le.analysis.contrastThreshold": 7.0,
  "colors-le.analysis.includePaletteAnalysis": true,
  "colors-le.output.format": "hex",
  "colors-le.output.includePosition": true,
  "colors-le.output.includeContext": true,
  "colors-le.safety.enabled": true,
  "colors-le.safety.fileSizeWarnBytes": 2097152,
  "colors-le.safety.maxColorsThreshold": 15000,
  "colors-le.safety.processingTimeWarnMs": 10000,
  "colors-le.notificationsLevel": "all",
  "colors-le.showParseErrors": true,
  "colors-le.telemetryEnabled": true
}
```

### Development Configuration

```json
{
  "colors-le.extraction.includeComments": true,
  "colors-le.extraction.includeNamedColors": true,
  "colors-le.extraction.includeTransparent": true,
  "colors-le.analysis.wcagLevel": "AA",
  "colors-le.analysis.contrastThreshold": 4.5,
  "colors-le.analysis.includePaletteAnalysis": true,
  "colors-le.output.format": "hex",
  "colors-le.output.includePosition": true,
  "colors-le.output.includeContext": true,
  "colors-le.safety.enabled": false,
  "colors-le.safety.fileSizeWarnBytes": 10485760,
  "colors-le.safety.maxColorsThreshold": 50000,
  "colors-le.safety.processingTimeWarnMs": 30000,
  "colors-le.notificationsLevel": "all",
  "colors-le.showParseErrors": true,
  "colors-le.telemetryEnabled": true
}
```

## Configuration Validation

Colors-LE validates all configuration values and provides fallbacks for invalid settings:

### Invalid Values

- **Invalid Types**: Fall back to default values
- **Out of Range**: Clamp to valid ranges
- **Missing Values**: Use default values
- **Corrupted Settings**: Reset to defaults

### Validation Rules

- `wcagLevel`: Must be "AA" or "AAA"
- `contrastThreshold`: Must be between 1.0 and 21.0
- `fileSizeWarnBytes`: Must be positive integer
- `maxColorsThreshold`: Must be positive integer
- `processingTimeWarnMs`: Must be positive integer
- `notificationsLevel`: Must be "all", "important", or "silent"
- `output.format`: Must be "hex", "rgb", "hsl", or "named"

## Configuration Changes

### Real-time Updates

Configuration changes are applied immediately:

- **Extraction Settings**: Affect new extractions
- **Analysis Settings**: Affect new analyses
- **Output Settings**: Affect new outputs
- **Safety Settings**: Affect new operations
- **Notification Settings**: Affect new notifications

### Restart Required

Some settings may require extension restart:

- **Telemetry Settings**: Require restart for logging changes
- **Safety Settings**: May require restart for memory management

## Troubleshooting

### Configuration Issues

1. **Settings Not Applied**: Check VS Code settings validation
2. **Invalid Values**: Check configuration schema
3. **Performance Issues**: Adjust safety thresholds
4. **Missing Features**: Verify feature flags

### Debug Configuration

Enable debug logging to see configuration values:

```json
{
  "colors-le.telemetryEnabled": true
}
```

Check VS Code Output panel for configuration logs.

### Reset Configuration

To reset all settings to defaults:

1. Open VS Code Settings
2. Search for "colors-le"
3. Click "Reset Setting" for each option
4. Or delete the settings from `settings.json`

## Best Practices

### Performance Optimization

- Disable unnecessary features for better performance
- Adjust safety thresholds based on your needs
- Use silent notifications for batch processing
- Disable telemetry in production

### Accessibility Compliance

- Use WCAG AAA level for maximum accessibility
- Set appropriate contrast thresholds
- Include palette analysis for color harmony
- Show parse errors for debugging

### Development Workflow

- Enable all features for comprehensive analysis
- Use higher safety thresholds for large files
- Enable telemetry for debugging
- Show all notifications for feedback
