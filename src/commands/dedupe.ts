import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { readColorList } from '../utils/colorList';
import { dedupeColors } from '../utils/dedupe';
import { replaceDocumentContent } from '../utils/document';
import { describeError } from '../utils/errors';
import { hasPosition, onValues } from '../utils/positions';
import { guarded } from './guard';

export function registerDedupeCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'colors-le.postProcess.dedupe',
		guarded(deps.notifier, async () => {
			deps.telemetry.event('command-dedupe-colors');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showWarning(vscode.l10n.t('No active editor found'));
				return;
			}

			try {
				deps.statusBar.showProgress(vscode.l10n.t('Deduplicating colors...'));

				const document = editor.document;
				const list = readColorList(document.getText());
				if ('other' in list) {
					deps.notifier.showWarning(
						vscode.l10n.t(
							'Deduplicate Colors reads a list of colors, one per line, as Extract Colors writes it. Line {0} is not a color: {1}',
							list.other.line,
							list.other.text,
						),
					);
					return;
				}
				const colorsToDedupe = list.lines;

				// By colour, keeping the first: with positions every line differs.
				const dedupedLines = onValues(colorsToDedupe, dedupeColors);

				// applyEdit resolves false when the edit is rejected — a read-only
				// document, or one that changed underneath the command. Discarding
				// it announced a result over a document that was never touched.
				const applied = await replaceDocumentContent(document, dedupedLines);
				if (!applied) {
					deps.notifier.showError(
						vscode.l10n.t('Could not deduplicate: the edit was rejected.'),
					);
					return;
				}

				const originalCount = colorsToDedupe.length;
				const dedupedCount = dedupedLines.length;
				const removedCount = originalCount - dedupedCount;

				const summary = vscode.l10n.t(
					'Removed {0} duplicate color(s) ({1} remaining)',
					removedCount,
					dedupedCount,
				);
				// A color found five times has five positions, and only one can stay.
				deps.notifier.showInfo(
					colorsToDedupe.some(hasPosition)
						? `${summary}. ${vscode.l10n.t('Each color shows its first position only.')}`
						: summary,
				);
				deps.telemetry.event('dedupe-success', {
					original: originalCount,
					deduped: dedupedCount,
				});
			} catch (error) {
				const message = describeError(error);
				deps.notifier.showError(
					vscode.l10n.t('Deduplication failed: {0}', message),
				);
				deps.telemetry.event('dedupe-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		}),
	);

	context.subscriptions.push(command);
}
