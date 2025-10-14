import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';

export interface StatusBar {
	showProgress(message: string): void;
	hideProgress(): void;
	dispose(): void;
}

export function createStatusBar(context: vscode.ExtensionContext): StatusBar {
	const config = getConfiguration();
	let statusBarItem: vscode.StatusBarItem | undefined;

	if (config.statusBarEnabled) {
		statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100,
		);
		statusBarItem.text = 'Colors-LE';
		statusBarItem.tooltip = 'Colors-LE: Color extraction and analysis';
		statusBarItem.command = 'colors-le.extractColors';
		context.subscriptions.push(statusBarItem);
		statusBarItem.show();
	}

	return Object.freeze({
		showProgress(message: string): void {
			if (statusBarItem) {
				statusBarItem.text = `$(loading~spin) ${message}`;
			}
		},
		hideProgress(): void {
			if (statusBarItem) {
				statusBarItem.text = 'Colors-LE';
			}
		},
		dispose(): void {
			statusBarItem?.dispose();
		},
	});
}
