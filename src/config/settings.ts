import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';

export function registerOpenSettingsCommand(
	context: vscode.ExtensionContext,
	telemetry: Telemetry,
): void {
	const command = vscode.commands.registerCommand(
		'colors-le.openSettings',
		async () => {
			telemetry.event('command-open-settings');
			await vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'colors-le',
			);
		},
	);

	context.subscriptions.push(command);
}
