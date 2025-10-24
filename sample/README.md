# Colors-LE Sample Files

Test files for Colors-LE color extraction functionality. Use these files to explore color detection across different formats and scenarios.

---

## 📋 Sample Files Overview

| File             | Format     | Color Count | Description                                                              |
| ---------------- | ---------- | ----------- | ------------------------------------------------------------------------ |
| `styles.css`     | CSS        | ~100+       | Complete CSS stylesheet with variables, gradients, and complex selectors |
| `index.html`     | HTML       | ~70+        | HTML with inline styles, embedded CSS, and various color formats         |
| `components.jsx` | JavaScript | ~80+        | React/JSX with styled-components and inline styles                       |
| `theme.ts`       | TypeScript | ~150+       | TypeScript theme configuration with type definitions                     |

---

## 🎯 Quick Start

### 1. Extract Colors from CSS

1. Open `sample/styles.css`
2. Run **Extract Colors** (`Cmd/Ctrl+Alt+C`)
3. See all colors from CSS variables, selectors, and gradients

### 2. Extract Colors from HTML

1. Open `sample/index.html`
2. Run **Extract Colors** (`Cmd/Ctrl+Alt+C`)
3. See colors from inline styles and embedded CSS

### 3. Extract Colors from JavaScript

1. Open `sample/components.jsx`
2. Run **Extract Colors** (`Cmd/Ctrl+Alt+C`)
3. See colors from styled-components and inline styles

### 4. Extract Colors from TypeScript

1. Open `sample/theme.ts`
2. Run **Extract Colors** (`Cmd/Ctrl+Alt+C`)
3. See colors from theme configuration objects

---

## 🎨 Color Format Categories

### 1. Hex Colors (3-digit, 6-digit, 8-digit)

**Files**: All sample files  
**Examples**:

```css
/* 3-digit hex */
#fff, #000, #f0f

/* 6-digit hex */
#ffffff, #3b82f6, #10b981

/* 8-digit hex (with alpha) */
#3b82f6cc, #ef444480;
```

**Test Scenarios**:

- Short hex notation (#fff)
- Full hex notation (#ffffff)
- 8-digit hex with alpha channel (#3b82f6cc)
- Uppercase and lowercase variations
- Colors in CSS variables (--primary: #3b82f6)
- Colors in inline styles (style="color: #3b82f6")

### 2. RGB/RGBA Colors

**Files**: `styles.css`, `index.html`, `components.jsx`  
**Examples**:

```css
/* RGB */
rgb(59, 130, 246)
rgb(255, 255, 255)

/* RGBA */
rgba(0, 0, 0, 0.1)
rgba(59, 130, 246, 0.75)
```

**Test Scenarios**:

- Standard RGB notation
- RGBA with decimal alpha (0.1, 0.5, 0.9)
- RGBA with integer alpha (0, 1)
- RGB in box-shadows and gradients
- RGB in styled-components

### 3. HSL/HSLA Colors

**Files**: `styles.css`, `index.html`, `theme.ts`  
**Examples**:

```css
/* HSL */
hsl(217, 91%, 60%)
hsl(158, 64%, 52%)

/* HSLA */
hsla(217, 19%, 27%, 0.8)
hsla(220, 13%, 91%, 0.5)
```

**Test Scenarios**:

- Standard HSL notation
- HSLA with transparency
- HSL in background colors
- HSL in theme configurations
- HSL with degree notation (hsl(217deg, 91%, 60%))

### 4. Gradients (Linear, Radial)

**Files**: `styles.css`, `components.jsx`, `theme.ts`  
**Examples**:

```css
/* Linear gradients */
linear-gradient(135deg, #667eea 0%, #764ba2 100%)
linear-gradient(to right, #ff6b6b, #feca57, #ee5a6f)

/* Radial gradients */
radial-gradient(circle, #3b82f6, #2563eb)
```

**Test Scenarios**:

- Linear gradients with angles (135deg, 45deg)
- Linear gradients with directions (to right, to bottom)
- Multi-stop gradients (3+ colors)
- Gradients with RGBA colors
- Gradients in styled-components
- Gradients in TypeScript theme objects

**Files**: `styles.css`, `index.html`, `components.jsx`  
**Examples**:

```css
/* Box shadows */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);

/* Text shadows */
text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
```

**Test Scenarios**:

- Single shadow
- Multiple shadows (comma-separated)
- Shadows with RGBA colors
- Inset shadows
- Shadows in animations

### 6. CSS Variables

**Files**: `styles.css`  
**Examples**:

```css
:root {
  --primary-blue: #3b82f6;
  --overlay-light: rgba(255, 255, 255, 0.9);
  --hsl-blue: hsl(217, 91%, 60%);
}

.button {
  background-color: var(--primary-blue);
}
```

**Test Scenarios**:

- CSS custom properties definition
- Variables with hex colors
- Variables with RGB/RGBA colors
- Variables with HSL/HSLA colors
- Variables in :root
- Variables in media queries

**Files**: `components.jsx`  
**Examples**:

```javascript
const Button = styled.button`
  background-color: #3b82f6;
  color: #ffffff;

  &:hover {
    background-color: #2563eb;
  }
`
```

**Test Scenarios**:

- Styled components with template literals
- Nested selectors (&:hover, &:active)
- Multiple color properties
- Gradients in styled components
- Conditional styling with props

### 8. Inline Styles (JavaScript Objects)

**Files**: `components.jsx`, `index.html`, `theme.ts`  
**Examples**:

```javascript
const styles = {
  container: {
    backgroundColor: '#f9fafb',
    color: '#111827',
  },
}

;<div style={{ color: '#3b82f6' }}>Text</div>
```

**Test Scenarios**:

- Style objects with camelCase properties
- Direct inline styles in JSX
- Nested style objects
- Style objects with gradients
- Theme objects with color definitions

### 10. Complex Color Scenarios

**Files**: All sample files  
**Examples**:

```css
/* Multiple colors in single property */
border: 2px solid #e5e7eb;
box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);

/* Colors in animations */
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  100% {
    box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
  }
}

/* Colors in media queries */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1f2937;
  }
}
```

**Test Scenarios**:

- Multiple colors in single property
- Colors in animations
- Colors in media queries
- Colors in pseudo-elements
- Colors in attribute selectors
- Colors with calc() functions

---

## ⚙️ Configuration Test Cases

### Test 1: Basic Extraction (Default Settings)

**Goal**: Extract all colors in their original format  
**Steps**:

1. Open any sample file
2. Run **Extract Colors**
3. Verify colors appear in original format
4. Verify no sorting or deduplication

**Expected**: All colors extracted, one per line, original format preserved

---

### Test 2: Deduplication Enabled

**Goal**: Remove duplicate colors  
**Settings**: `colors-le.dedupeEnabled: true`  
**Steps**:

1. Open `styles.css` (has duplicate colors)
2. Run **Extract Colors**
3. Verify duplicates are removed

**Expected**: Only unique colors appear once

---

### Test 3: Sort by Hue Ascending

**Goal**: Sort colors by hue value  
**Settings**:

- `colors-le.sortEnabled: true`
- `colors-le.sortMode: "hue-asc"`

**Steps**:

1. Open any sample file
2. Run **Extract Colors**
3. Verify colors are sorted by hue (red → orange → yellow → green → blue → purple)

**Expected**: Colors sorted by hue in ascending order

---

### Test 4: Sort by Lightness Descending

**Goal**: Sort colors from light to dark  
**Settings**:

- `colors-le.sortEnabled: true`
- `colors-le.sortMode: "lightness-desc"`

**Steps**:

1. Open any sample file
2. Run **Extract Colors**
3. Verify colors are sorted from lightest to darkest

**Expected**: Light colors first, dark colors last

---

### Test 5: Large File Warning

**Goal**: Test safety warning for large files  
**Settings**: `colors-le.safety.enabled: true`  
**Steps**:

1. Create a CSS file > 1MB (duplicate `styles.css` content many times)
2. Run **Extract Colors**
3. Verify warning appears before processing

**Expected**: Warning dialog with option to proceed or cancel

---

### Test 6: Side-by-Side Results

**Goal**: Open results beside source file  
**Settings**: `colors-le.openResultsSideBySide: true`  
**Steps**:

1. Open any sample file
2. Run **Extract Colors**
3. Verify results open in split view

**Expected**: Source file and results visible side-by-side

---

### Test 7: Copy to Clipboard

**Goal**: Auto-copy results to clipboard  
**Settings**: `colors-le.copyToClipboardEnabled: true`  
**Steps**:

1. Open any sample file
2. Run **Extract Colors**
3. Paste clipboard content (Cmd/Ctrl+V)

**Expected**: Extracted colors available in clipboard

---

### Test 8: Notification Levels

**Goal**: Test notification verbosity  
**Settings**: Try each level:

- `colors-le.notificationsLevel: "silent"` - No notifications
- `colors-le.notificationsLevel: "important"` - Only important messages
- `colors-le.notificationsLevel: "all"` - All messages

**Steps**:

1. Change notification level
2. Run **Extract Colors**
3. Observe notification behavior

**Expected**: Notifications match configured level

---

### Test 9: Status Bar Integration

**Goal**: Test status bar functionality  
**Settings**: `colors-le.statusBar.enabled: true`  
**Steps**:

1. Run **Extract Colors**
2. Check status bar (bottom right)
3. Click status bar item

**Expected**:

- Status bar shows extraction count
- Click opens last results
- Auto-hides after 5 seconds

---

### Test 10: Telemetry Logging

**Goal**: Test local telemetry logging  
**Settings**: `colors-le.telemetryEnabled: true`  
**Steps**:

1. Enable telemetry
2. Run **Extract Colors**
3. Open Output panel → "Colors-LE"

**Expected**: See extraction logs with timing and counts

---

## 🧪 Edge Cases & Error Scenarios

### Edge Case 1: Empty File

**File**: Create empty CSS file  
**Expected**: No colors found message

### Edge Case 2: No Colors in File

**File**: Create file with text but no colors  
**Expected**: No colors found message

### Edge Case 3: Invalid Color Formats

**File**: Create file with malformed colors  
**Expected**: Invalid colors ignored, valid colors extracted

### Edge Case 4: Mixed Format File

**File**: `index.html` (has inline styles + embedded CSS)  
**Expected**: All colors extracted from both sections

### Edge Case 5: Very Long Gradient

**File**: Create gradient with 20+ color stops  
**Expected**: All colors extracted

### Edge Case 6: Uppercase Hex Colors

**File**: Create file with #FFFFFF, #3B82F6  
**Expected**: Colors extracted in original case

### Edge Case 7: Spaces in RGB/HSL

**File**: `rgb( 255 , 255 , 255 )`  
**Expected**: Colors extracted despite extra spaces

### Edge Case 8: Colors in Comments

**File**: Create CSS with colors in comments  
**Expected**: Colors in comments extracted (they're valid CSS)

### Edge Case 9: Unsupported File Types

**File**: Open `.txt` or `.md` file  
**Expected**: Command disabled or "not supported" message

### Edge Case 10: Very Large Output (50,000+ colors)

**File**: Create CSS with 50,000+ colors  
**Expected**: Large output warning, option to proceed or cancel

---

## 📊 Performance Benchmarks

### Small Files (< 10KB)

- **styles.css**: ~2KB, ~100 colors
- **Expected**: < 100ms extraction time

### Medium Files (10KB - 100KB)

- Duplicate `styles.css` 50x
- **Expected**: < 500ms extraction time

### Large Files (100KB - 1MB)

- Duplicate `styles.css` 500x
- **Expected**: < 3 seconds extraction time

### Very Large Files (> 1MB)

- Should trigger safety warning
- **Expected**: Warning before processing

---

## 🛠️ Troubleshooting

### Issue: No Colors Extracted

**Possible Causes**:

1. File type not supported (only CSS, HTML, JS, TS, JSX, TSX)
2. No valid colors in file
3. Colors in unsupported format

**Solution**:

- Verify file extension is supported
- Check that colors use valid CSS color formats
- Enable parse errors: `colors-le.showParseErrors: true`

---

### Issue: Unexpected Colors Extracted

**Possible Causes**:

1. Colors in comments extracted
2. String literals containing color-like patterns

**Solution**:

- This is expected behavior - all valid color patterns are extracted
- Use deduplication to remove duplicates
- Manually filter results as needed

---

### Issue: Performance Issues

**Possible Causes**:

1. Very large file (> 1MB)
2. Sorting/deduplication enabled on large output

**Solution**:

- Enable safety warnings: `colors-le.safety.enabled: true`
- Disable sorting for faster extraction
- Disable deduplication for faster extraction
- Process smaller file sections

---

### Issue: Results Not Appearing

**Possible Causes**:

1. Extension not activated
2. Command not registered
3. VS Code error

**Solution**:

- Reload VS Code window: **Developer: Reload Window**
- Check VS Code Output panel → "Colors-LE" for errors
- Enable telemetry for detailed logs

---

## 💡 Best Practices

### 1. Use CSS Variables for Theme Management

```css
:root {
  --primary: #3b82f6;
  --secondary: #8b5cf6;
}
```

✓ Easy to extract all theme colors at once  
✓ Centralized color management

### 2. Enable Deduplication for Large Files

```json
{
  "colors-le.dedupeEnabled": true
}
```

✓ Reduces output size  
✓ Shows only unique colors

### 3. Sort by Hue for Color Palettes

```json
{
  "colors-le.sortEnabled": true,
  "colors-le.sortMode": "hue-asc"
}
```

✓ Visual color progression  
✓ Easy to identify color families

### 4. Use Side-by-Side for Review

```json
{
  "colors-le.openResultsSideBySide": true
}
```

✓ Compare source and results  
✓ Quick verification

### 5. Enable Safety Checks

```json
{
  "colors-le.safety.enabled": true,
  "colors-le.safety.fileSizeWarnBytes": 1000000
}
```

✓ Prevents performance issues  
✓ Warns before large operations

---

## 🎯 Recommended Workflow

### For Theme Development

1. Create theme configuration file (`theme.ts` or `theme.js`)
2. Run **Extract Colors** to see all colors
3. Enable **Sort by Hue** to organize palette
4. Enable **Dedupe** to remove duplicates
5. Export results for documentation

### For Design System Audit

1. Open main CSS file
2. Enable **Dedupe** and **Sort by Lightness**
3. Run **Extract Colors**
4. Review for inconsistencies (too many similar colors)
5. Consolidate similar colors into CSS variables

### For Color Migration

1. Open old stylesheet
2. Extract all colors
3. Map to new design system colors
4. Use find/replace to update
5. Verify with second extraction

### For Accessibility Review

1. Extract all colors from stylesheet
2. Use external tool to check contrast ratios
3. Identify colors failing WCAG standards
4. Update colors in source
5. Re-extract to verify changes

---

## 📝 Sample File Details

### styles.css (CSS)

**Size**: ~2KB  
**Colors**: ~100+  
**Formats**: Hex, RGB/RGBA, HSL/HSLA, Named  
**Features**:

- CSS custom properties (CSS variables)
- Gradients (linear)
- Box shadows
- Media queries
- Animations

**Best For**: Testing CSS variable extraction, gradients, and media queries

---

### index.html (HTML)

**Size**: ~3KB  
**Colors**: ~70+  
**Formats**: Hex, RGB/RGBA, HSL/HSLA  
**Features**:

- Inline styles
- Embedded CSS (style tags)
- Mixed color formats
- Complex nesting

**Best For**: Testing inline style extraction and embedded CSS

---

### components.jsx (JavaScript/JSX)

**Size**: ~4KB  
**Colors**: ~80+  
**Formats**: Hex, RGB/RGBA  
**Features**:

- Styled components
- Inline style objects
- Direct JSX inline styles
- Nested selectors
- Pseudo-classes

**Best For**: Testing React/JSX color extraction and styled-components

---

### theme.ts (TypeScript)

**Size**: ~5KB  
**Colors**: ~150+  
**Formats**: Hex, RGB/RGBA, HSL/HSLA  
**Features**:

- Theme configuration objects
- Type definitions
- Light and dark themes
- Gradient definitions
- RGBA overlays

**Best For**: Testing TypeScript theme extraction and type-safe color definitions

---

## 🚀 Next Steps

1. **Try all sample files** - Get familiar with different formats
2. **Experiment with settings** - Test different sort modes and options
3. **Create your own test files** - Add colors from your projects
4. **Report issues** - Found a bug? [Open an issue](https://github.com/OffensiveEdge/colors-le/issues)
5. **Share feedback** - Rate on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=OffensiveEdge.colors-le)

---

## 📚 Additional Resources

- **README**: Complete feature documentation
- **CONFIGURATION.md**: Detailed settings guide
- **COMMANDS.md**: All available commands
- **TROUBLESHOOTING.md**: Common issues and solutions
- **PERFORMANCE.md**: Performance tips and benchmarks

---

**Need Help?** Check the [GitHub Issues](https://github.com/OffensiveEdge/colors-le/issues) or open a new issue.

**Found a bug?** Please report it with:

1. Sample file (or minimal reproduction)
2. Expected behavior
3. Actual behavior
4. Colors-LE version
5. VS Code version

---

Copyright © 2025 @OffensiveEdge. All rights reserved.
