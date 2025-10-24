import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';

export function registerHelpCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'colors-le.help',
		async () => {
			deps.telemetry.event('command-help');

			const helpText = `
# Colors-LE Help & Troubleshooting

## Commands
- **Extract Colors** (Ctrl+Alt+C / Cmd+Alt+C): Extract colors from the current document
- **Deduplicate Colors**: Remove duplicate colors from the current document
- **Sort Colors**: Sort colors by various criteria (hue, saturation, lightness, hex)
- **Open Settings**: Configure Colors-LE settings
- **Help**: Open this help documentation

## Supported File Types
- CSS - Stylesheets, CSS variables, gradients
- HTML - Inline styles, embedded style tags
- JavaScript - JS, JSX with styled-components
- TypeScript - TS, TSX with styled-components

## Color Formats Supported
- Hexadecimal: #FF0000, #f00, #ff0000aa
- RGB: rgb(255, 0, 0)
- RGBA: rgba(255, 0, 0, 0.5)
- HSL: hsl(0, 100%, 50%)
- HSLA: hsla(0, 100%, 50%, 0.5)

## Troubleshooting

### No colors found
- Ensure the file contains valid color values
- Check that the file type is supported
- Verify color format is recognized

### Performance issues
- Large files may take time to process
- Use safety settings to limit processing
- Consider breaking large files into smaller chunks

## Settings
Access settings via Command Palette: "Colors-LE: Open Settings"

Key settings:
- Copy to clipboard (auto-copy results)
- Deduplication (remove duplicates)
- Sorting mode (hue, saturation, lightness, hex)
- Side-by-side view (open results beside source)
- Safety checks (file size warnings)
- Notification levels (silent, important, all)
- Status bar (show/hide)
- Telemetry (local logging)

## Support
- GitHub Issues: https://github.com/OffensiveEdge/colors-le/issues
- Documentation: https://github.com/OffensiveEdge/colors-le#readme
		`.trim();

			const doc = await vscode.workspace.openTextDocument({
				content: helpText,
				language: 'markdown',
			});
			await vscode.window.showTextDocument(doc, {
				preview: false,
				viewColumn: vscode.ViewColumn.Beside,
			});
		},
	);

	context.subscriptions.push(command);
}
