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
 * The help document. Every sentence goes through the bundle, so it reads in
 * the host's language; format names, notations and links are not words and
 * stay as they are. The command titles are the bundle's copies of the
 * manifest's, held equal by the test beside this file, so a user finds in
 * the palette what the document names; the formats and notations are the
 * extractor's own lists.
 */
function helpDocument(): string {
	return [
		`# ${vscode.l10n.t('Colors-LE Help')}`,
		'',
		`## ${vscode.l10n.t('Quick Start')}`,
		`1. ${vscode.l10n.t('Open a file with colors (CSS, SCSS, HTML, JSON, etc.)')}`,
		`2. ${vscode.l10n.t('Run "Colors-LE: Extract Colors" from the command palette')}`,
		`3. ${vscode.l10n.t('Extracted colors open in a new document')}`,
		'',
		`## ${vscode.l10n.t('Commands')}`,
		command(
			vscode.l10n.t('Extract Colors'),
			vscode.l10n.t('Extract from the current document'),
		),
		command(
			vscode.l10n.t('Extract Colors from Workspace'),
			vscode.l10n.t(
				'The palette of every file in the workspace: each color once, with its spellings and where it is',
			),
		),
		command(
			vscode.l10n.t('Extract Colors from Folder'),
			vscode.l10n.t(
				'The same for one folder. Also on a folder in the Explorer',
			),
		),
		command(
			vscode.l10n.t('Analyze Colors'),
			vscode.l10n.t(
				'Statistics, clusters, patterns and a palette report for the current document',
			),
		),
		command(
			vscode.l10n.t('Convert Colors'),
			vscode.l10n.t(
				"Convert the current document's colors to hex, rgb, rgba, hsl, hsla or oklch",
			),
		),
		command(
			vscode.l10n.t('Filter Colors'),
			vscode.l10n.t(
				"Filter the current document's colors by format, lightness and saturation",
			),
		),
		command(
			vscode.l10n.t('Validate Colors'),
			vscode.l10n.t(
				"Check each color's format, and its contrast against a background you name",
			),
		),
		command(
			vscode.l10n.t('Deduplicate Colors'),
			vscode.l10n.t('Remove duplicate lines from a list of colors'),
		),
		command(
			vscode.l10n.t('Sort Colors'),
			vscode.l10n.t(
				'Sort a list of colors by hue, saturation, lightness or hex, as the sortMode setting says',
			),
		),
		command(
			vscode.l10n.t('Open Settings'),
			vscode.l10n.t('Open the Colors-LE settings'),
		),
		command(
			vscode.l10n.t('Help & Troubleshooting'),
			vscode.l10n.t('Show this document'),
		),
		'',
		`## ${vscode.l10n.t('Supported Formats')}`,
		vscode.l10n.t(
			'{0} have a format-aware extractor. Every other document is scanned as raw text.',
			FORMATS,
		),
		'',
		`## ${vscode.l10n.t('Color Notations')}`,
		vscode.l10n.t(
			'{0}, and the CSS named colors including transparent',
			NOTATIONS,
		),
		'',
		`## ${vscode.l10n.t('Troubleshooting')}`,
		`- **${vscode.l10n.t('No colors found?')}** ${vscode.l10n.t(
			'Every document is scanned whatever its language, so check that each color is written in one of the notations above. A named color counts only where a value is expected: a declaration value, an attribute, a whole string',
		)}`,
		`- **${vscode.l10n.t('Large file warning?')}** ${vscode.l10n.t(
			'Adjust the safety file-size threshold in settings',
		)}`,
		`- **${vscode.l10n.t('Deduplicate or Sort refused the document?')}** ${vscode.l10n.t(
			'They read a list of colors, one per line, as Extract Colors writes it, and leave any other document untouched',
		)}`,
		'',
		`## ${vscode.l10n.t('Settings')}`,
		vscode.l10n.t('Run "Colors-LE: Open Settings" from the command palette'),
		'',
		`## ${vscode.l10n.t('Support')}`,
		`- ${vscode.l10n.t('GitHub Issues')}: ${ISSUES}`,
		`- ${vscode.l10n.t('Documentation')}: ${README}`,
		`- ${vscode.l10n.t('LE Tools')}: ${SITE}`,
		'',
		vscode.l10n.t("Enjoying it? A rating helps more than you'd think:"),
		`- ${vscode.l10n.t('Rate on VS Code Marketplace')}: ${MARKETPLACE_REVIEWS}`,
		`- ${vscode.l10n.t('Rate on Open VSX')}: ${OPEN_VSX_REVIEWS}`,
		'',
		vscode.l10n.t(
			'Built by {0} — MIT licensed.',
			'nolindnaidoo (https://github.com/nolindnaidoo)',
		),
	].join('\n');
}
