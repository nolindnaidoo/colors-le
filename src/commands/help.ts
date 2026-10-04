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
- **Analyze Colors**: Analyze the current document's colors (distribution, stats)
- **Convert Colors**: Convert extracted colors to another format
- **Filter Colors**: Filter extracted colors by format
- **Validate Colors**: Validate colors and check contrast
- **Deduplicate Colors**: Remove duplicate colors from the current document
- **Sort Colors**: Sort colors by various criteria (hue, saturation, lightness, hex)
- **Open Settings**: Configure Colors-LE settings
- **Help**: Open this help documentation

## Supported File Types
- CSS, SCSS, LESS, Stylus
- HTML - Inline styles, embedded style tags
- JavaScript / TypeScript - string literals and style objects
- SVG - fill/stroke/stop-color attributes and inline styles

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

## Support
- GitHub Issues: https://github.com/nolindnaidoo/colors-le/issues
- Documentation: https://github.com/nolindnaidoo/colors-le#readme
- LE Tools: https://letools.dev

Enjoying it? A rating helps more than you'd think:
- Rate on VS Code Marketplace: https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le&ssr=false#review-details
- Rate on Open VSX: https://open-vsx.org/extension/nolindnaidoo/colors-le/reviews

Built by nolindnaidoo (https://github.com/nolindnaidoo) — MIT licensed.
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
