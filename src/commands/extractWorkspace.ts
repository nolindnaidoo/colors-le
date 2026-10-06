import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import { extractColorsFromText } from '../extraction/extract';
import { resolveFormat } from '../mcp/fileType';
import { parseColor, rgbToHex } from '../utils/colorConversion';
import { NAMED_COLOR_RGB } from '../utils/namedColors';
import {
	listFiles,
	type ScanLimits,
	type ScanSummary,
	scanFiles,
	unreadNotes,
} from '../workspace/scan';
import {
	askForFolder,
	code,
	deliver,
	hasSomethingToScan,
	limitsFrom,
	type WorkspaceDeps,
} from './workspaceShared';

/** One place a color is written, and how it is spelled there. */
export interface Occurrence {
	readonly file: string;
	readonly written: string;
	readonly position:
		| { readonly line: number; readonly column: number }
		| undefined;
}

/** One color, however it is spelled, and every place it was found. */
export interface DistinctColor {
	/** The color as hex where it can be read as one, and as written where it cannot. */
	readonly color: string;
	readonly occurrences: readonly Occurrence[];
}

/**
 * What two spellings share when they are the same color.
 *
 * `#f00`, `#FF0000`, `red` and `rgb(255, 0, 0)` are one color written four
 * ways, and a palette that lists them apart hides that. A value this cannot
 * read as a color in sRGB — a `var()`, a wide-gamut space — is compared as
 * written, lower-cased, so it still groups with its own repeats.
 */
export function sameColorKey(value: string): string {
	const text = value.trim();
	const named = NAMED_COLOR_RGB[text.toLowerCase()];
	if (named !== undefined)
		return rgbToHex({ r: named[0], g: named[1], b: named[2] });
	const rgb = parseColor(text);
	return rgb === null ? text.toLowerCase() : rgbToHex(rgb);
}

export function registerExtractWorkspaceCommands(
	context: vscode.ExtensionContext,
	deps: WorkspaceDeps,
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('colors-le.extractWorkspace', async () =>
			extractWorkspace(deps),
		),
		// The Explorer hands over the folder that was clicked. From the
		// palette there is none, and the command asks.
		vscode.commands.registerCommand(
			'colors-le.extractFolder',
			async (picked?: vscode.Uri) => {
				const folder = picked ?? (await askForFolder());
				if (folder !== undefined) await extractWorkspace(deps, folder);
			},
		),
	);
}

/**
 * Extract every color in every file under a folder, or in the whole
 * workspace when no folder is given.
 *
 * The answer is the project's palette: each color once, however it is
 * spelled, with the spellings and the places. Files are read from disk, so
 * an unsaved edit is not seen.
 */
async function extractWorkspace(
	deps: WorkspaceDeps,
	root?: vscode.Uri,
): Promise<void> {
	deps.telemetry.event(
		root === undefined ? 'command-extract-workspace' : 'command-extract-folder',
	);
	if (!hasSomethingToScan(root, deps)) return;
	const config = getConfiguration();
	const limits = limitsFrom(config);

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: vscode.l10n.t('Scanning files...'),
			cancellable: true,
		},
		async (progress, token) => {
			const { files, fileLimitReached, ignored } = await listFiles(
				root,
				limits,
			);
			const found = new Map<string, Occurrence[]>();
			let total = 0;
			const scanned = await scanFiles(
				root,
				files,
				limits,
				token,
				(done, all) =>
					progress.report({
						message: vscode.l10n.t('{0} of {1} files', done, all),
					}),
				({ file, text }) => {
					for (const color of extractColorsFromText(
						text,
						resolveFormat(undefined, file),
					)) {
						if (total >= config.workspaceScanMaxResults) return false;
						const occurrence = {
							file,
							written: color.value,
							position: color.position,
						};
						const key = sameColorKey(color.value);
						const where = found.get(key);
						if (where === undefined) found.set(key, [occurrence]);
						else where.push(occurrence);
						total++;
					}
					return total < config.workspaceScanMaxResults;
				},
			);
			// A cancelled scan read part of the tree. Reporting that as the
			// project's palette would understate it without saying so.
			if (scanned.cancelled) return;
			const summary: ScanSummary = { ...scanned, fileLimitReached, ignored };

			const colors = distinct(found);
			const where =
				root === undefined
					? undefined
					: vscode.workspace.asRelativePath(root, false);
			await deliver(
				(positions) =>
					formatExtractWorkspaceReport({
						where,
						colors,
						summary,
						limits,
						positions,
					}),
				config,
				deps,
			);

			deps.telemetry.event('extract-workspace-completed', {
				files: summary.read,
				colors: colors.length,
				occurrences: total,
			});
			deps.notifier.showInfo(headline(colors));
		},
	);
}

/**
 * The most widely used first, then by the color's own text.
 *
 * A plain comparison rather than `localeCompare`: the order must not change
 * with the editor's display language.
 */
function distinct(found: ReadonlyMap<string, Occurrence[]>): DistinctColor[] {
	return [...found]
		.map(([color, occurrences]) => ({ color, occurrences }))
		.sort(
			(a, b) =>
				b.occurrences.length - a.occurrences.length ||
				(a.color < b.color ? -1 : Number(a.color > b.color)),
		);
}

function filesOf(occurrences: readonly Occurrence[]): string[] {
	return [...new Set(occurrences.map((occurrence) => occurrence.file))];
}

/** The spellings of one color, the most used first. */
function spellings(occurrences: readonly Occurrence[]): string[] {
	const counts = new Map<string, number>();
	for (const { written } of occurrences)
		counts.set(written, (counts.get(written) ?? 0) + 1);
	return [...counts]
		.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : Number(a[0] > b[0])))
		.map(([written]) => written);
}

function headline(colors: readonly DistinctColor[]): string {
	const occurrences = colors.flatMap((color) => color.occurrences);
	return vscode.l10n.t(
		'{0} distinct color(s), {1} occurrence(s) in {2} file(s)',
		colors.length,
		occurrences.length,
		filesOf(occurrences).length,
	);
}

export interface ExtractWorkspaceReportInput {
	/** The folder that was scanned, or undefined for the whole workspace. */
	readonly where: string | undefined;
	readonly colors: readonly DistinctColor[];
	readonly summary: ScanSummary;
	readonly limits: ScanLimits;
	readonly positions?: boolean;
}

/**
 * The report for a folder or a workspace: a table of the distinct colors
 * with how each is spelled, how often and in how many files, then where each
 * one is, and last whatever the scan left unread.
 */
export function formatExtractWorkspaceReport({
	where,
	colors,
	summary,
	limits,
	positions = true,
}: ExtractWorkspaceReportInput): string {
	const lines: string[] = [
		`# ${vscode.l10n.t('{0} workspace report', 'Colors-LE')}`,
		'',
	];
	const scope = where === undefined ? '' : `${code(where)} · `;
	lines.push(
		`${scope}${vscode.l10n.t('{0} file(s) read', summary.read)} · ${headline(colors)}`,
		'',
	);
	if (colors.length === 0) lines.push(vscode.l10n.t('No colors found.'), '');

	if (colors.length > 0) {
		lines.push(
			`| ${vscode.l10n.t('Color')} | ${vscode.l10n.t('Written as')} | ${vscode.l10n.t('Occurrences')} | ${vscode.l10n.t('Files')} |`,
			'|---|---|---|---|',
		);
		for (const color of colors)
			lines.push(
				`| ${cell(color.color)} | ${spellings(color.occurrences).map(cell).join(', ')} | ${color.occurrences.length} | ${filesOf(color.occurrences).length} |`,
			);
		lines.push('');
	}

	for (const color of colors) {
		lines.push(`## ${code(color.color)} (${color.occurrences.length})`, '');
		// One line per file, with every place in it.
		for (const file of filesOf(color.occurrences)) {
			const here = color.occurrences.filter((o) => o.file === file);
			const placed = here.flatMap((o) =>
				o.position === undefined
					? []
					: [`**${o.position.line}:${o.position.column}**`],
			);
			if (positions && placed.length > 0)
				lines.push(`- ${code(file)} · ${placed.join(', ')}`);
			else
				lines.push(
					here.length > 1
						? `- ${code(file)} (${here.length})`
						: `- ${code(file)}`,
				);
		}
		lines.push('');
	}

	const notes = unreadNotes(summary, limits, code('colors-le.workspace.*'));
	if (notes.length > 0) lines.push(...notes.map((note) => `> ${note}`), '');
	return lines.join('\n');
}

/** A code span that is safe inside a table cell. */
function cell(text: string): string {
	return code(text).replace(/\|/g, '\\|');
}
