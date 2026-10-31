import * as vscode from 'vscode';
import type { Notifier } from '../ui/notifier';
import { describeError } from './errors';

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
			vscode.l10n.t(
				'Results too large for the clipboard ({0} characters); skipping the copy',
				text.length,
			),
		);
		return false;
	}

	try {
		await vscode.env.clipboard.writeText(text);
		notifier.showInfo(
			vscode.l10n.t(
				'Extracted {0} color(s) and copied to the clipboard',
				count,
			),
		);
		return true;
	} catch (error) {
		notifier.showWarning(
			vscode.l10n.t(
				'Extracted the colors, but could not copy them to the clipboard: {0}',
				describeError(error),
			),
		);
		return false;
	}
}
