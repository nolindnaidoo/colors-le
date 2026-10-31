import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { guarded } from './guard';

const ISSUES = 'https://github.com/nolindnaidoo/colors-le/issues';
const README = 'https://github.com/nolindnaidoo/colors-le#readme';
const SITE = 'https://letools.dev';
const MARKETPLACE_REVIEWS =
	'https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le&ssr=false#review-details';
const OPEN_VSX_REVIEWS =
	'https://open-vsx.org/extension/nolindnaidoo/colors-le/reviews';
/** The formats with a reader of their own, as `mcp/fileType.ts` lists them. */
const FORMATS =
	'CSS, SCSS, LESS, Stylus, HTML, JavaScript, TypeScript, SVG, XML, JSON, YAML, TOML, Markdown, plain text';
const NOTATIONS =
	'#rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba(), hsl(), hsla(), hwb(), lab(), lch(), oklab(), oklch(), color()';

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
		guarded(deps.notifier, async () => {
			deps.telemetry.event('command-help');

			const doc = await vscode.workspace.openTextDocument({
				content: helpDocument(),
				language: 'markdown',
			});
			await vscode.window.showTextDocument(doc, {
				preview: false,
				viewColumn: vscode.ViewColumn.Beside,
			});
		}),
	);

	context.subscriptions.push(command);
}

/** A command line: the title the palette shows in bold, then what it does. */
function command(title: string, does: string): string {
	return `- **${title}**: ${does}`;
}

/**
 * The help document. The command titles are the manifest's, held equal by
 * the test beside this file, so a user finds in the palette what the
 * document names; the formats and notations are the extractor's own lists.
 * It used to list four file types after fourteen were read and five
 * notations after fourteen were found.
 */
function helpDocument(): string {
	return [
		'# Colors-LE Help',
		'',
		'## Quick Start',
		'1. Open a file with colors (CSS, SCSS, HTML, JSON, etc.)',
		'2. Run "Colors-LE: Extract Colors" from the command palette',
		'3. Extracted colors open in a new document',
		'',
		'## Commands',
		command('Extract Colors', 'Extract from the current document'),
		command(
			'Extract Colors from Workspace',
			'The palette of every file in the workspace: each color once, with its spellings and where it is',
		),
		command(
			'Extract Colors from Folder',
			'The same for one folder. Also on a folder in the Explorer',
		),
		command(
			'Analyze Colors',
			'Statistics, clusters, patterns and a palette report for the current document',
		),
		command(
			'Convert Colors',
			"Convert the current document's colors to hex, rgb, rgba, hsl, hsla or oklch",
		),
		command(
			'Filter Colors',
			"Filter the current document's colors by format, lightness and saturation",
		),
		command(
			'Validate Colors',
			"Check each color's format, and its contrast against a background you name",
		),
		command(
			'Deduplicate Colors',
			'Remove duplicate lines from a list of colors',
		),
		command(
			'Sort Colors',
			'Sort a list of colors by hue, saturation, lightness or hex, as the sortMode setting says',
		),
		command('Open Settings', 'Open the Colors-LE settings'),
		command('Help & Troubleshooting', 'Show this document'),
		'',
		'## Supported Formats',
		`${FORMATS} have a format-aware extractor. Every other document is scanned as raw text.`,
		'',
		'## Color Notations',
		`${NOTATIONS}, and the CSS named colors including transparent`,
		'',
		'## Troubleshooting',
		'- **No colors found?** Every document is scanned whatever its language, so check that each color is written in one of the notations above. A named color counts only where a value is expected: a declaration value, an attribute, a whole string',
		'- **Large file warning?** Adjust the safety file-size threshold in settings',
		'- **Deduplicate or Sort refused the document?** They read a list of colors, one per line, as Extract Colors writes it, and leave any other document untouched',
		'',
		'## Settings',
		'Run "Colors-LE: Open Settings" from the command palette',
		'',
		'## Support',
		`- GitHub Issues: ${ISSUES}`,
		`- Documentation: ${README}`,
		`- LE Tools: ${SITE}`,
		'',
		"Enjoying it? A rating helps more than you'd think:",
		`- Rate on VS Code Marketplace: ${MARKETPLACE_REVIEWS}`,
		`- Rate on Open VSX: ${OPEN_VSX_REVIEWS}`,
		'',
		'Built by nolindnaidoo (https://github.com/nolindnaidoo) — MIT licensed.',
	].join('\n');
}
