import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { getConfiguration } from '../config/config';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { sortColors } from '../utils/sort';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

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
		async () => {
			deps.telemetry.event('command-sort-colors');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showWarning(
					localize('runtime.sort.no-editor', 'No active editor found'),
				);
				return;
			}

			try {
				deps.statusBar.showProgress(
					localize('runtime.sort.progress', 'Sorting colors...'),
				);

				const document = editor.document;
				const text = document.getText();
				const lines = text
					.split('\n')
					.filter((line) => line.trim().length > 0)
					.map((line) => line.trim());
				const config = getConfiguration();

				// Check if this looks like a colors file (simple heuristic)
				const isColorFile =
					lines.length > 0 &&
					lines.every((line) => {
						const trimmed = line.trim();
						return (
							trimmed === '' ||
							/^#[0-9a-f]{6}$/i.test(trimmed) ||
							/^rgb\(/.test(trimmed) ||
							/^hsl\(/.test(trimmed)
						);
					});

				let colorsToSort: string[];
				if (isColorFile) {
					// Use lines directly as colors
					colorsToSort = lines;
				} else {
					// Extract colors from source file first
					// For simplicity, filter lines that look like colors
					colorsToSort = lines.filter(
						(line) =>
							/^#[0-9a-f]{6}$/i.test(line) ||
							/^rgb\(/.test(line) ||
							/^hsl\(/.test(line),
					);
				}

				// Sort colors based on configuration
				const sortedLines = sortColors(colorsToSort, config.sortMode);

				// Replace document content
				const edit = new vscode.WorkspaceEdit();
				edit.replace(
					document.uri,
					new vscode.Range(0, 0, document.lineCount, 0),
					sortedLines.join('\n'),
				);
				await vscode.workspace.applyEdit(edit);

				deps.notifier.showInfo(
					localize(
						'runtime.sort.success',
						'Sorted {0} colors by {1}',
						sortedLines.length,
						config.sortMode,
					),
				);
				deps.telemetry.event('sort-success', {
					mode: config.sortMode,
					count: sortedLines.length,
				});
			} catch (error) {
				const message =
					error instanceof Error
						? error.message
						: localize(
								'runtime.error.unknown-fallback',
								'Unknown error occurred',
							);
				deps.notifier.showError(
					localize('runtime.sort.error', 'Sorting failed: {0}', message),
				);
				deps.telemetry.event('sort-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		},
	);

	context.subscriptions.push(command);
}
