# Colors-LE Notifications System

API-style guide for the notification layer used across commands and UI components.

## Overview

- Purpose: provide concise user feedback while respecting user-configured verbosity.
- Backed by VS Code notifications; titles and messages should be localized by callers.
- Prefer subtle feedback via Status Bar where possible; reserve notifications for actionable info.

## Public interface

```ts
export interface Notifier {
	info(message: string): void
	warn(message: string): void
	error(message: string): void
}

export function createNotifier(): Notifier
```

- Messages should be caller-localized using `vscode-nls` with `MessageFormat.file`.

## Behavior

- Respects `colors-le.notificationsLevel` at call time
- Mapping by level:
  - `all`: shows info, warnings, and errors
  - `important`: shows warnings and errors only
  - `silent`: shows errors only

## Usage examples

### Basic notifications

```typescript
import { createNotifier } from '../ui/notifier'
import * as nls from 'vscode-nls'

const localize = nls.config({ messageFormat: nls.MessageFormat.file })()
const notifier = createNotifier()

// Info notification (shown when level is 'all')
notifier.info(localize('runtime.extract.success', 'Extracted {0} colors', count))

// Warning notification (shown when level is 'all' or 'important')
notifier.warn(localize('runtime.extract.large-file', 'Large file detected: {0}MB', fileSizeMB))

// Error notification (always shown)
notifier.error(localize('runtime.error.parsing', 'Failed to parse file: {0}', error.message))
```

### Command integration

```typescript
export function registerExtractCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		notifier: Notifier
		statusBar: StatusBar
	}>
): void {
	const command = vscode.commands.registerCommand('colors-le.extractColors', async () => {
		try {
			// Show progress in status bar
			deps.statusBar.showProgress('Extracting colors...')
			
			const result = await extractColors(document)
			
			// Success notification
			deps.notifier.info(
				localize('runtime.extract.success', 'Extracted {0} colors', result.count)
			)
			
		} catch (error) {
			// Error notification
			deps.notifier.error(
				localize('runtime.error.extraction', 'Extraction failed: {0}', error.message)
			)
		} finally {
			deps.statusBar.hideProgress()
		}
	})
	
	context.subscriptions.push(command)
}
```

## Configuration

### Notification levels

```json
{
  "colors-le.notificationsLevel": "all"
}
```

**Options**:
- `"all"`: Show all notifications including info messages
- `"important"`: Show only important notifications and errors
- `"silent"`: Suppress all notifications except critical errors

### Settings integration

```typescript
export function getConfiguration(): Configuration {
	const config = vscode.workspace.getConfiguration('colors-le')
	
	return Object.freeze({
		notificationsLevel: config.get('notificationsLevel', 'silent'),
		// ... other settings
	})
}
```

## Best practices

### When to use notifications

**Use notifications for**:
- Critical errors that require user attention
- Important warnings about file size or performance
- Success confirmations for major operations
- Actionable information that requires user response

**Avoid notifications for**:
- Routine operations (use status bar instead)
- Debug information (use output channel instead)
- Frequent updates (use progress indicators instead)
- Non-actionable information

### Message guidelines

**Keep messages concise**:
```typescript
// Good
notifier.info('Extracted 42 colors')

// Avoid
notifier.info('The color extraction process has completed successfully and found 42 unique colors in the current document')
```

**Use consistent terminology**:
```typescript
// Good
notifier.error('Parsing error')
notifier.error('Validation error')

// Avoid
notifier.error('Parse failed')
notifier.error('Invalid input')
```

**Include relevant context**:
```typescript
// Good
notifier.warn('Large file detected: 15MB')

// Avoid
notifier.warn('File is large')
```

## Error handling

### Graceful degradation

```typescript
export function createNotifier(): Notifier {
	const config = getConfiguration()
	
	return Object.freeze({
		info(message: string): void {
			if (config.notificationsLevel === 'all') {
				vscode.window.showInformationMessage(message)
			}
		},
		
		warn(message: string): void {
			if (config.notificationsLevel === 'all' || config.notificationsLevel === 'important') {
				vscode.window.showWarningMessage(message)
			}
		},
		
		error(message: string): void {
			// Errors are always shown
			vscode.window.showErrorMessage(message)
		}
	})
}
```

### Fallback behavior

- If notification system fails, fall back to VS Code's default notifications
- Log errors to output channel for debugging
- Ensure core functionality continues even if notifications fail

## Testing

### Unit tests

```typescript
import { createNotifier } from '../ui/notifier'

describe('Notifier', () => {
	it('should respect notification level settings', () => {
		const notifier = createNotifier()
		
		// Mock VS Code window
		const showInfoSpy = jest.spyOn(vscode.window, 'showInformationMessage')
		
		notifier.info('Test message')
		
		// Verify notification was shown based on configuration
		expect(showInfoSpy).toHaveBeenCalledWith('Test message')
	})
})
```

### Integration tests

- Test with different notification level configurations
- Verify messages are properly localized
- Test error handling and fallback behavior
- Ensure notifications don't interfere with core functionality

## Troubleshooting

### Common issues

**Notifications not showing**:
- Check `colors-le.notificationsLevel` setting
- Verify VS Code notification settings
- Check for conflicting extensions

**Messages not localized**:
- Ensure `vscode-nls` is properly configured
- Check translation files are present
- Verify key names match between code and translations

**Performance impact**:
- Avoid showing notifications in tight loops
- Use status bar for frequent updates
- Consider debouncing for rapid operations

### Debug tips

- Use VS Code Developer Tools to inspect notification behavior
- Check the Output panel for notification-related errors
- Test with different notification level settings
- Use browser dev tools to inspect DOM for notification elements
