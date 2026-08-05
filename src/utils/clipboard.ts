import * as vscode from 'vscode';
import type { Notifier } from '../ui/notifier';

/** Above this the copy is abandoned rather than attempted. */
const MAX_CLIPBOARD_CHARS = 1_000_000;

/**
 * Copy results to the clipboard, reporting failure as a warning.
 *
 * Returns whether the copy landed. The results are already in an editor by the
 * time this runs, so an unavailable clipboard — a remote or headless session —
 * is not an extraction failure.
 */
export async function copyResults(
	text: string,
	count: number,
	notifier: Notifier,
): Promise<boolean> {
	if (text.length > MAX_CLIPBOARD_CHARS) {
		notifier.showWarning(
			`Results too large for clipboard (${text.length} characters), skipping clipboard copy`,
		);
		return false;
	}

	try {
		await vscode.env.clipboard.writeText(text);
		notifier.showInfo(`Extracted ${count} colors and copied to clipboard`);
		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		notifier.showWarning(
			vscode.l10n.t(
				'Extracted the colors, but could not copy them to the clipboard: {0}',
				message,
			),
		);
		return false;
	}
}
