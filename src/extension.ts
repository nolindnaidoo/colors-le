import type * as vscode from 'vscode';
import { registerCommands } from './commands';
import { registerOpenSettingsCommand } from './config/settings';
import { registerCodeActions } from './providers/codeActions';
import { createTelemetry } from './telemetry/telemetry';
import { createNotifier } from './ui/notifier';
import { createStatusBar } from './ui/statusBar';

export function activate(context: vscode.ExtensionContext): void {
	const telemetry = createTelemetry();
	const notifier = createNotifier();
	const statusBar = createStatusBar(context);

	// Register disposables to prevent memory leaks
	context.subscriptions.push(telemetry);
	context.subscriptions.push(statusBar);

	// Register all commands
	registerCommands(context, {
		telemetry,
		notifier,
		statusBar,
	});

	// Register settings command
	registerOpenSettingsCommand(context, telemetry);

	// Register code actions provider
	registerCodeActions(context);

	telemetry.event('extension-activated');
}

export function deactivate(): void {
	// Extensions are automatically disposed via context.subscriptions
}
