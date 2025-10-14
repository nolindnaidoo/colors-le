# Colors-LE Status Bar System

API-style guide for the Status Bar integration providing subtle feedback and quick access to the main command.

## Overview

- Purpose: provide low-noise, always-available entrypoint and progress hints
- Placement: Left alignment, priority 100
- Command: `colors-le.extractColors`

## Public interface

```ts
export interface StatusBar {
	flash(text: string): void
	showProgress(text: string): void
	hideProgress(): void
}

export function createStatusBar(context: vscode.ExtensionContext): StatusBar
```

Implementation reference: `src/ui/statusBar.ts`.

## Behavior

- Default text: `$(color-palette) Colors-LE`
- Tooltip: localized, e.g., `Run Colors-LE: Extract Colors`
- Click action: runs `colors-le.extractColors`
- Analysis indicator: when analysis is enabled, text shows `Colors-LE (Analysis)`
- `flash(text)`: temporarily sets status text for ~2 seconds, then restores default/analysis label
- Respects `colors-le.statusBar.enabled`: hides/shows on change

## Usage examples

### Basic status bar

```typescript
import { createStatusBar } from '../ui/statusBar'

export function activate(context: vscode.ExtensionContext): void {
	const statusBar = createStatusBar(context)
	
	// Status bar is automatically created and shown
	// User can click to run extract command
}
```

### Progress indication

```typescript
export function registerExtractCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		statusBar: StatusBar
	}>
): void {
	const command = vscode.commands.registerCommand('colors-le.extractColors', async () => {
		try {
			// Show progress
			deps.statusBar.showProgress('Extracting colors...')
			
			const result = await extractColors(document)
			
			// Flash success message
			deps.statusBar.flash(`Extracted ${result.count} colors`)
			
		} catch (error) {
			// Flash error message
			deps.statusBar.flash('Extraction failed')
		} finally {
			// Hide progress
			deps.statusBar.hideProgress()
		}
	})
	
	context.subscriptions.push(command)
}
```

### Configuration-based behavior

```typescript
export function createStatusBar(context: vscode.ExtensionContext): StatusBar {
	const config = getConfiguration()
	
	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100
	)
	
	// Set default text based on configuration
	const baseText = '$(color-palette) Colors-LE'
	const analysisText = config.analysis.enabled ? ' (Analysis)' : ''
	statusBarItem.text = `${baseText}${analysisText}`
	
	// Set tooltip
	statusBarItem.tooltip = localize('runtime.statusbar.tooltip', 'Run Colors-LE: Extract Colors')
	
	// Set command
	statusBarItem.command = 'colors-le.extractColors'
	
	// Show/hide based on configuration
	if (config.statusBar.enabled) {
		statusBarItem.show()
	}
	
	return Object.freeze({
		flash(text: string): void {
			const originalText = statusBarItem.text
			statusBarItem.text = text
			
			// Restore original text after 2 seconds
			setTimeout(() => {
				statusBarItem.text = originalText
			}, 2000)
		},
		
		showProgress(text: string): void {
			statusBarItem.text = `$(loading~spin) ${text}`
		},
		
		hideProgress(): void {
			const baseText = '$(color-palette) Colors-LE'
			const analysisText = config.analysis.enabled ? ' (Analysis)' : ''
			statusBarItem.text = `${baseText}${analysisText}`
		}
	})
}
```

## Configuration

### Status bar settings

```json
{
  "colors-le.statusBar.enabled": true
}
```

**Options**:
- `true`: Show status bar entry (default)
- `false`: Hide status bar entry

### Dynamic updates

```typescript
export function onDidChangeConfiguration(event: vscode.ConfigurationChangeEvent): void {
	if (event.affectsConfiguration('colors-le.statusBar.enabled')) {
		const config = getConfiguration()
		
		if (config.statusBar.enabled) {
			statusBarItem.show()
		} else {
			statusBarItem.hide()
		}
	}
}
```

## Best practices

### When to use status bar

**Use status bar for**:
- Quick access to main command
- Progress indication for long operations
- Brief success/error feedback
- Always-visible extension presence

**Avoid status bar for**:
- Detailed error messages (use notifications)
- Complex information (use output channel)
- Frequent updates (use progress indicators)
- User input requests (use input boxes)

### Message guidelines

**Keep messages concise**:
```typescript
// Good
statusBar.flash('Extracted 42 colors')

// Avoid
statusBar.flash('Successfully extracted 42 unique colors from the current document')
```

**Use consistent terminology**:
```typescript
// Good
statusBar.showProgress('Extracting colors...')
statusBar.showProgress('Analyzing colors...')

// Avoid
statusBar.showProgress('Processing...')
statusBar.showProgress('Working...')
```

**Include relevant context**:
```typescript
// Good
statusBar.flash('Extracted 42 colors (3 duplicates)')

// Avoid
statusBar.flash('Done')
```

## Error handling

### Graceful degradation

```typescript
export function createStatusBar(context: vscode.ExtensionContext): StatusBar {
	try {
		const statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100
		)
		
		return Object.freeze({
			flash(text: string): void {
				try {
					// Implementation
				} catch (error) {
					// Log error but don't break functionality
					console.error('Status bar flash failed:', error)
				}
			},
			
			showProgress(text: string): void {
				try {
					// Implementation
				} catch (error) {
					console.error('Status bar progress failed:', error)
				}
			},
			
			hideProgress(): void {
				try {
					// Implementation
				} catch (error) {
					console.error('Status bar hide progress failed:', error)
				}
			}
		})
	} catch (error) {
		// Return no-op implementation if status bar creation fails
		return Object.freeze({
			flash: () => {},
			showProgress: () => {},
			hideProgress: () => {}
		})
	}
}
```

## Testing

### Unit tests

```typescript
import { createStatusBar } from '../ui/statusBar'

describe('StatusBar', () => {
	it('should create status bar item', () => {
		const mockContext = {} as vscode.ExtensionContext
		const statusBar = createStatusBar(mockContext)
		
		expect(statusBar).toBeDefined()
		expect(typeof statusBar.flash).toBe('function')
		expect(typeof statusBar.showProgress).toBe('function')
		expect(typeof statusBar.hideProgress).toBe('function')
	})
	
	it('should flash message temporarily', (done) => {
		const statusBar = createStatusBar(mockContext)
		
		statusBar.flash('Test message')
		
		// Verify message is shown
		expect(statusBarItem.text).toBe('Test message')
		
		// Wait for restoration
		setTimeout(() => {
			expect(statusBarItem.text).toBe('$(color-palette) Colors-LE')
			done()
		}, 2100)
	})
})
```

### Integration tests

- Test status bar visibility with different configurations
- Verify click action runs correct command
- Test progress indication and restoration
- Ensure status bar updates when configuration changes

## Troubleshooting

### Common issues

**Status bar not showing**:
- Check `colors-le.statusBar.enabled` setting
- Verify VS Code status bar is not hidden
- Check for conflicting extensions

**Click action not working**:
- Verify command is properly registered
- Check command ID matches between status bar and registration
- Ensure extension is properly activated

**Progress not updating**:
- Check for errors in progress methods
- Verify status bar item is properly created
- Test with different progress messages

### Debug tips

- Use VS Code Developer Tools to inspect status bar behavior
- Check the Output panel for status bar-related errors
- Test with different status bar configurations
- Use browser dev tools to inspect DOM for status bar elements
