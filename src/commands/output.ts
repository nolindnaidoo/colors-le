import * as vscode from 'vscode';
import type { Configuration } from '../types';
import type { Notifier } from '../ui/notifier';
import { sanitizeErrorMessage } from '../utils/errors';

/**
 * Delivering extraction results: beside the source, or over the document.
 *
 * Returns whether the results reached the user. A failed open, or an edit the
 * workspace rejected, used to be reported as an error and then followed by
 * "Extracted N colors" — a failure and a success for one action.
 */
export async function deliverResults(
	content: string,
	document: vscode.TextDocument,
	config: Configuration,
	notifier: Notifier,
): Promise<boolean> {
	try {
		if (config.openResultsSideBySide) {
			const doc = await vscode.workspace.openTextDocument({
				content,
				language: 'plaintext',
			});
			await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
			return true;
		}

		const edit = new vscode.WorkspaceEdit();
		edit.replace(
			document.uri,
			new vscode.Range(
				document.positionAt(0),
				document.lineAt(document.lineCount - 1).range.end,
			),
			content,
		);
		// applyEdit resolves false for a read-only document, or one that changed
		// underneath the command.
		const applied = await vscode.workspace.applyEdit(edit);
		if (!applied) {
			notifier.showError(
				vscode.l10n.t(
					'Could not replace the document contents: the edit was rejected.',
				),
			);
			return false;
		}
		return true;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Failed to open results';
		notifier.showError(
			`Failed to open results: ${sanitizeErrorMessage(message)}. Try copying results to clipboard instead.`,
		);
		return false;
	}
}
