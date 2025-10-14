# Colors-LE Workflow Guide

Practical workflows that turn common pain points into fast, repeatable actions.

## Why this exists (real‑world pain points)

### Design system maintenance (CSS/SCSS frameworks)
- You need to audit color usage across components, themes, and design tokens.
- Pain: hunting scattered color values, identifying duplicates, and ensuring brand consistency.
- Relief: extract colors from CSS/SCSS files, dedupe/sort, and analyze for accessibility compliance.

### Frontend frameworks (React/Next.js, Vue/Nuxt, SvelteKit, Angular) + styling
- You want to catalog color usage across components and ensure design system compliance.
- Pain: colors live across CSS modules, styled-components, and inline styles; manual grepping is noisy.
- Relief: extract from CSS/SCSS/JS/TS files, analyze usage patterns, and produce clean palettes for review.

### Theme migration and updates
- You're migrating from legacy themes to new design systems or updating brand colors.
- Pain: scattered color values across multiple files make it easy to miss updates.
- Relief: extract colors from old themes, compare with new palettes, and identify what needs updating.

### Accessibility compliance (WCAG)
- You need to ensure color combinations meet accessibility standards across your application.
- Pain: manually checking contrast ratios and identifying problematic color pairs.
- Relief: extract colors, analyze contrast ratios, and flag accessibility issues automatically.

---

## Core workflows

### 1) Quick extract & review (any supported file)
1. Open a supported file (`CSS`, `SCSS`, `JavaScript`, `TypeScript`, `JSON`, `YAML`, `HTML`).
2. Run `Colors-LE: Extract Colors` (`Cmd/Ctrl+Alt+C` or Status Bar).
3. If prompted for large output, choose Open or Copy.
4. Optionally run Dedupe/Sort to tidy results.

### 2) Design system audit
1. Open your main CSS/SCSS file (e.g., `styles.css`, `theme.scss`).
2. Run `Colors-LE: Extract Colors`.
3. Run `Colors-LE: Analyze Colors` for accessibility insights.
4. Review extracted palette for consistency and brand compliance.

### 3) Component color analysis
1. Open component files (CSS modules, styled-components, etc.).
2. Extract colors from each component.
3. Compare results side-by-side to identify shared colors.
4. Use analysis features to check accessibility compliance.

### 4) Theme migration workflow
1. Extract colors from old theme files.
2. Extract colors from new theme files.
3. Compare palettes to identify missing or changed colors.
4. Update components with new color values.

---

## Advanced workflows

### 5) Accessibility compliance check
1. Extract colors from your application files.
2. Run `Colors-LE: Analyze Colors` for WCAG compliance.
3. Review contrast ratios and accessibility issues.
4. Update problematic color combinations.

### 6) Brand consistency audit
1. Extract colors from all brand-related files.
2. Identify duplicate colors with different values.
3. Standardize color usage across the application.
4. Create a unified color palette.

### 7) Performance optimization
1. Extract colors from large CSS files.
2. Identify unused or duplicate colors.
3. Optimize color usage to reduce file size.
4. Monitor performance impact of color changes.

---

## File type workflows

### CSS/SCSS files
- **Primary use**: Design system maintenance, theme updates
- **Workflow**: Extract → Analyze → Optimize
- **Key features**: CSS custom properties, named colors, hex/rgb/hsl values

### JavaScript/TypeScript files
- **Primary use**: Component color analysis, inline style auditing
- **Workflow**: Extract → Compare → Standardize
- **Key features**: String literals, template literals, object properties

### JSON/YAML files
- **Primary use**: Configuration color auditing, design token management
- **Workflow**: Extract → Validate → Update
- **Key features**: Nested objects, arrays, configuration values

### HTML files
- **Primary use**: Template color analysis, inline style auditing
- **Workflow**: Extract → Review → Update
- **Key features**: Inline styles, CSS classes, attribute values

---

## Configuration workflows

### 8) Custom extraction settings
1. Configure `colors-le.extraction.includeComments` for documentation colors
2. Set `colors-le.extraction.includeNamedColors` for CSS named colors
3. Adjust `colors-le.extraction.includeTransparent` for alpha values
4. Test extraction with different settings

### 9) Analysis configuration
1. Set `colors-le.analysis.wcagLevel` (AA or AAA)
2. Configure `colors-le.analysis.contrastThreshold` for custom requirements
3. Enable `colors-le.analysis.includePaletteAnalysis` for color relationships
4. Run analysis with different configurations

### 10) Output formatting
1. Choose `colors-le.output.format` (hex, rgb, hsl, named)
2. Set `colors-le.output.includePosition` for line/column info
3. Configure `colors-le.output.includeContext` for surrounding code
4. Customize output for different use cases

---

## Integration workflows

### 11) VS Code integration
1. Use Command Palette (`Ctrl+Shift+P`) for all commands
2. Right-click context menu for quick extraction
3. Status bar for always-available access
4. Keyboard shortcuts for power users

### 12) Team collaboration
1. Share extracted color palettes with team members
2. Use analysis results for accessibility discussions
3. Standardize color usage across projects
4. Document color decisions and rationale

### 13) CI/CD integration
1. Extract colors as part of build process
2. Validate color usage against design system
3. Check accessibility compliance automatically
4. Fail builds on color-related issues

---

## Troubleshooting workflows

### 14) Common issues
1. **No colors found**: Check file type support and color formats
2. **Parse errors**: Verify color syntax and file encoding
3. **Performance issues**: Adjust safety settings for large files
4. **Missing features**: Check configuration and extension version

### 15) Debug workflow
1. Enable `colors-le.telemetryEnabled` for detailed logging
2. Check Output panel for error messages
3. Test with different file types and sizes
4. Verify VS Code and extension versions

---

## Best practices

### File organization
- Keep color-related files organized by purpose
- Use consistent naming conventions
- Document color decisions and rationale
- Version control color changes

### Performance considerations
- Use safety settings for large files
- Enable performance monitoring
- Optimize color usage regularly
- Monitor memory usage

### Accessibility compliance
- Run accessibility analysis regularly
- Check contrast ratios for all color combinations
- Update problematic colors promptly
- Document accessibility decisions

### Team collaboration
- Share color palettes and analysis results
- Standardize color usage across projects
- Use consistent naming conventions
- Document color decisions and rationale
