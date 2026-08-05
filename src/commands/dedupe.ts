import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { dedupeColors } from '../utils/dedupe';

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
		async () => {
			deps.telemetry.event('command-dedupe-colors');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showWarning(vscode.l10n.t('No active editor found'));
				return;
			}

			try {
				deps.statusBar.showProgress('Deduplicating colors...');

				const document = editor.document;
				const text = document.getText();
				const lines = text
					.split('\n')
					.filter((line) => line.trim().length > 0)
					.map((line) => line.trim());

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

				let colorsToDedupe: string[];
				if (isColorFile) {
					// Use lines directly as colors
					colorsToDedupe = lines;
				} else {
					// Extract colors from source file first
					// For simplicity, filter lines that look like colors
					colorsToDedupe = lines.filter(
						(line) =>
							/^#[0-9a-f]{6}$/i.test(line) ||
							/^rgb\(/.test(line) ||
							/^hsl\(/.test(line),
					);
				}

				// Extract colors from each line and dedupe
				const dedupedLines = dedupeColors(colorsToDedupe);

				// Replace document content
				const edit = new vscode.WorkspaceEdit();
				edit.replace(
					document.uri,
					new vscode.Range(
						document.positionAt(0),
						document.lineAt(document.lineCount - 1).range.end,
					),
					dedupedLines.join('\n'),
				);
				// applyEdit resolves false when the edit is rejected — a read-only
				// document, or one that changed underneath the command. Discarding
				// it announced a result over a document that was never touched.
				const applied = await vscode.workspace.applyEdit(edit);
				if (!applied) {
					deps.notifier.showError(
						vscode.l10n.t('Could not deduplicate: the edit was rejected.'),
					);
					return;
				}

				const originalCount = colorsToDedupe.length;
				const dedupedCount = dedupedLines.length;
				const removedCount = originalCount - dedupedCount;

				deps.notifier.showInfo(
					`Removed ${removedCount} duplicate colors (${dedupedCount} remaining)`,
				);
				deps.telemetry.event('dedupe-success', {
					original: originalCount,
					deduped: dedupedCount,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Unknown error occurred';
				deps.notifier.showError(
					vscode.l10n.t('Deduplication failed: {0}', message),
				);
				deps.telemetry.event('dedupe-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		},
	);

	context.subscriptions.push(command);
}
