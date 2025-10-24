import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import type {
	EnhancedError,
	ErrorRecoveryOptions,
	ErrorSummary,
} from '../utils/errorHandling';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export interface Notifier {
	showInfo(message: string): void;
	showWarning(message: string): void;
	showError(message: string): void;
	showEnhancedError(
		error: EnhancedError,
		options?: ErrorRecoveryOptions,
	): Promise<void>;
	showErrorSummary(summary: ErrorSummary): void;
	showProgress<T>(
		title: string,
		task: (
			progress: vscode.Progress<{ message?: string; increment?: number }>,
			token: vscode.CancellationToken,
		) => Promise<T>,
	): Promise<T>;
}

export function createNotifier(): Notifier {
	return Object.freeze({
		showInfo(message: string): void {
			vscode.window.showInformationMessage(message);
		},
		showWarning(message: string): void {
			vscode.window.showWarningMessage(message);
		},
		showError(message: string): void {
			vscode.window.showErrorMessage(message);
		},
		async showEnhancedError(
			error: EnhancedError,
			options?: ErrorRecoveryOptions,
		): Promise<void> {
			const severity = error.severity;
			const message = error.userMessage;
			const suggestion = error.suggestion;

			let fullMessage = message;
			if (suggestion) {
				fullMessage += `\n\n${localize('runtime.error.suggestion', 'Suggestion')}: ${suggestion}`;
			}

			if (options?.userAction) {
				fullMessage += `\n\n${localize('runtime.error.action', 'Action')}: ${options.userAction}`;
			}

			// Show appropriate notification based on severity
			switch (severity) {
				case 'high':
					await vscode.window.showErrorMessage(fullMessage, {
						modal: true,
						detail: error.message,
					});
					break;
				case 'medium':
					await vscode.window.showWarningMessage(fullMessage, {
						detail: error.message,
					});
					break;
				case 'low':
					await vscode.window.showInformationMessage(fullMessage, {
						detail: error.message,
					});
					break;
			}
		},
		showErrorSummary(summary: ErrorSummary): void {
			if (summary.totalErrors === 0) {
				this.showInfo(
					localize('runtime.error.summary.none', 'No errors occurred'),
				);
				return;
			}

			const criticalCount = summary.severity.high;
			const message = localize(
				'runtime.error.summary.notification',
				'Processing completed with {0} errors ({1} critical)',
				summary.totalErrors,
				criticalCount,
			);

			if (criticalCount > 0) {
				this.showError(message);
			} else if (summary.nonRecoverableErrors > 0) {
				this.showWarning(message);
			} else {
				this.showInfo(message);
			}
		},
		async showProgress<T>(
			title: string,
			task: (
				progress: vscode.Progress<{ message?: string; increment?: number }>,
				token: vscode.CancellationToken,
			) => Promise<T>,
		): Promise<T> {
			return vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title,
					cancellable: true,
				},
				task,
			);
		},
	});
}
