import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export function registerCodeActions(context: vscode.ExtensionContext): void {
	// Quick Fix to trigger color extraction across supported languages
	const languages: readonly string[] = [
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
	];
	const provider: vscode.CodeActionProvider = {
		provideCodeActions(document): vscode.CodeAction[] | undefined {
			const text = document.getText();
			if (!text || text.trim().length === 0) return undefined;
			const action = new vscode.CodeAction(
				localize('runtime.codeaction.extract.title', 'Extract colors'),
				vscode.CodeActionKind.QuickFix,
			);
			action.command = {
				command: 'colors-le.extractColors',
				title: localize('runtime.codeaction.extract.title', 'Extract colors'),
			};
			action.isPreferred = true;
			return [action];
		},
	};
	const providerMetadata: vscode.CodeActionProviderMetadata = {
		providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
	};
	for (const lang of languages) {
		context.subscriptions.push(
			vscode.languages.registerCodeActionsProvider(
				lang,
				provider,
				providerMetadata,
			),
		);
	}
}
