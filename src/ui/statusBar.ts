import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';

export interface StatusBar {
	showProgress(message: string): void;
	hideProgress(): void;
	dispose(): void;
}

export function createStatusBar(context: vscode.ExtensionContext): StatusBar {
	const config = getConfiguration();
	const statusBarItem = initializeStatusBarItem(config, context);

	return Object.freeze({
		showProgress(message: string): void {
			if (!statusBarItem) {
				return;
			}
			statusBarItem.text = `$(loading~spin) ${message}`;
		},
		hideProgress(): void {
			if (!statusBarItem) {
				return;
			}
			statusBarItem.text = 'Colors-LE';
		},
		dispose(): void {
			statusBarItem?.dispose();
		},
	});
}

function initializeStatusBarItem(
	config: ReturnType<typeof getConfiguration>,
	context: vscode.ExtensionContext,
): vscode.StatusBarItem | undefined {
	if (!config.statusBarEnabled) {
		return undefined;
	}

	const item = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100,
	);

	item.text = 'Colors-LE';
	item.tooltip = 'Colors-LE: Color extraction and analysis';
	item.command = 'colors-le.extractColors';

	context.subscriptions.push(item);
	item.show();

	return item;
}
