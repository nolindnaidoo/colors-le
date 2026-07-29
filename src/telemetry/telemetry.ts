import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';

/**
 * Local-only telemetry: events append to an output channel the user can
 * inspect. Nothing leaves the machine. telemetryEnabled is re-read per
 * event, so toggling it needs no reload.
 */
export interface Telemetry {
	event(name: string, properties?: Record<string, unknown>): void;
	dispose(): void;
}

export function createTelemetry(): Telemetry {
	let outputChannel: vscode.OutputChannel | undefined;

	return Object.freeze({
		event(name: string, properties?: Record<string, unknown>): void {
			if (!getConfiguration().telemetryEnabled) {
				return;
			}
			if (!outputChannel) {
				outputChannel = vscode.window.createOutputChannel(
					'Colors-LE Telemetry',
				);
			}
			const timestamp = new Date().toISOString();
			const props = properties ? ` ${JSON.stringify(properties)}` : '';
			outputChannel.appendLine(`[${timestamp}] ${name}${props}`);
		},
		dispose(): void {
			outputChannel?.dispose();
		},
	});
}
