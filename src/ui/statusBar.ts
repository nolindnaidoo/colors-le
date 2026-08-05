import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';

const IDLE_TEXT = 'Colors-LE';

export interface StatusBar {
	showProgress(message: string): void;
	hideProgress(): void;
	dispose(): void;
}

export function createStatusBar(context: vscode.ExtensionContext): StatusBar {
	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100,
	);
	statusBarItem.text = IDLE_TEXT;
	statusBarItem.tooltip = 'Colors-LE: Color extraction and analysis';
	statusBarItem.command = 'colors-le.extractColors';
	context.subscriptions.push(statusBarItem);

	const applyVisibility = (): void => {
		if (getConfiguration().statusBarEnabled) {
			statusBarItem.show();
			return;
		}
		statusBarItem.hide();
	};
	applyVisibility();

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('colors-le.statusBar.enabled')) {
				applyVisibility();
			}
		}),
	);

	return Object.freeze({
		showProgress(message: string): void {
			statusBarItem.text = `$(loading~spin) ${message}`;
		},
		hideProgress(): void {
			statusBarItem.text = IDLE_TEXT;
		},
		dispose(): void {
			statusBarItem.dispose();
		},
	});
}
