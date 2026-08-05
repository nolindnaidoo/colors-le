import * as vscode from 'vscode';

/**
 * Languages the Quick Fix is offered in. Exported so the registration and the
 * tests cannot disagree about the list.
 */
export const SUPPORTED_LANGUAGES: readonly string[] = Object.freeze([
	'css',
	'scss',
	'sass',
	'less',
	'stylus',
	'javascript',
	'typescript',
	'json',
	'yaml',
	'yml',
	'html',
]);

/**
 * Quick Fix that triggers colour extraction for the active document.
 *
 * Built by an exported factory rather than inline in `registerCodeActions`,
 * because registration hands the provider to VS Code and nothing gives it
 * back — the behaviour was unreachable from a unit test and sat at 0% branch
 * coverage as a result.
 */
export function createExtractColorsProvider(): vscode.CodeActionProvider {
	return {
		provideCodeActions(document): vscode.CodeAction[] | undefined {
			const text = document.getText();
			if (!text || text.trim().length === 0) return undefined;

			// The constructor argument is the label shown in the lightbulb menu;
			// command.title is not displayed there. Both come from one localized
			// value so they cannot drift.
			const title = vscode.l10n.t('Extract colors');
			const action = new vscode.CodeAction(
				title,
				vscode.CodeActionKind.QuickFix,
			);
			action.command = {
				command: 'colors-le.extractColors',
				title,
			};
			action.isPreferred = true;
			return [action];
		},
	};
}

export function registerCodeActions(context: vscode.ExtensionContext): void {
	const provider = createExtractColorsProvider();
	const providerMetadata: vscode.CodeActionProviderMetadata = {
		providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
	};

	for (const lang of SUPPORTED_LANGUAGES) {
		context.subscriptions.push(
			vscode.languages.registerCodeActionsProvider(
				lang,
				provider,
				providerMetadata,
			),
		);
	}
}
