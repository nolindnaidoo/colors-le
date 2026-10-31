import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { readColorList } from '../utils/colorList';
import { replaceDocumentContent } from '../utils/document';
import { onValues } from '../utils/positions';
import { sortColors } from '../utils/sort';
import { guarded } from './guard';

export function registerSortCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'colors-le.postProcess.sort',
		guarded(deps.notifier, async () => {
			deps.telemetry.event('command-sort-colors');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showWarning(vscode.l10n.t('No active editor found'));
				return;
			}

			try {
				deps.statusBar.showProgress('Sorting colors...');

				const document = editor.document;
				const list = readColorList(document.getText());
				if ('other' in list) {
					deps.notifier.showWarning(
						vscode.l10n.t(
							'Sort Colors reads a list of colors, one per line, as Extract Colors writes it. Line {0} is not a color: {1}',
							list.other.line,
							list.other.text,
						),
					);
					return;
				}
				const config = getConfiguration();

				// Sort colors based on configuration
				const sortedLines = onValues(list.lines, (values) =>
					sortColors(values, config.sortMode),
				);

				// applyEdit resolves false when the edit is rejected — a read-only
				// document, or one that changed underneath the command. Discarding
				// it announced a result over a document that was never touched.
				const applied = await replaceDocumentContent(document, sortedLines);
				if (!applied) {
					deps.notifier.showError(
						vscode.l10n.t('Could not sort: the edit was rejected.'),
					);
					return;
				}

				deps.notifier.showInfo(
					`Sorted ${sortedLines.length} colors by ${config.sortMode}`,
				);
				deps.telemetry.event('sort-success', {
					mode: config.sortMode,
					count: sortedLines.length,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Unknown error occurred';
				deps.notifier.showError(vscode.l10n.t('Sorting failed: {0}', message));
				deps.telemetry.event('sort-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		}),
	);

	context.subscriptions.push(command);
}
