import type * as vscode from 'vscode';
import { registerCommands } from './commands';
import { registerOpenSettingsCommand } from './config/settings';
import { registerCodeActions } from './providers/codeActions';
import { createServices } from './services/serviceFactory';

export function activate(context: vscode.ExtensionContext): void {
	// Create all core services using the service factory
	const services = createServices(context);

	// Register commands with services
	registerCommands(context, {
		telemetry: services.telemetry,
		notifier: services.notifier,
		statusBar: services.statusBar,
		performanceMonitor: services.performanceMonitor,
	});

	// Register settings command
	registerOpenSettingsCommand(context, services.telemetry);

	// Register code actions provider
	registerCodeActions(context);

	services.telemetry.event('extension-activated');
}

export function deactivate(): void {
	// Extensions are automatically disposed via context.subscriptions
}
