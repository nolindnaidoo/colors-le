import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import { extractColors } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { copyResults } from '../utils/clipboard';
import { dedupeColors } from '../utils/dedupe';
import { sanitizeErrorMessage } from '../utils/errors';
import { handleSafetyChecksWithUserConfirmation } from '../utils/safety';
import { deliverResults } from './output';

export function registerExtractCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'colors-le.extractColors',
		async () => {
			deps.telemetry.event('command-extract-colors');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showError(
					'No active editor found. Open a file to extract colors from.',
				);
				return;
			}

			const document = editor.document;
			const config = getConfiguration();

			const safetyResult = await handleSafetyChecksWithUserConfirmation(
				document,
				config,
				{
					allowOverride: true,
					customThresholds: {
						fileSizeBytes: config.safetyFileSizeWarnBytes,
						lineCount: config.safetyLargeOutputLinesThreshold,
					},
				},
			);
			if (!safetyResult.proceed) {
				deps.notifier.showWarning(safetyResult.message);
				return;
			}
			for (const warning of safetyResult.warnings) {
				deps.notifier.showWarning(warning);
			}

			try {
				const result = await deps.notifier.showProgress(
					'Extracting colors...',
					async (progress, token) => {
						if (token.isCancellationRequested) {
							throw new Error('Operation cancelled by user');
						}
						progress.report({ message: vscode.l10n.t('Analyzing file...') });

						const extractionResult = await extractColors(
							document.getText(),
							document.languageId,
							{
								filepath: document.fileName,
								includeMetadata: true,
								timeoutMs: 30000,
							},
						);

						if (token.isCancellationRequested) {
							throw new Error('Operation cancelled by user');
						}
						progress.report({
							message: vscode.l10n.t('Formatting results...'),
							increment: 50,
						});

						return extractionResult;
					},
				);

				if (!result.success && result.errors.length > 0) {
					const messages = result.errors
						.map((error) => sanitizeErrorMessage(error.message))
						.join('; ');
					deps.notifier.showError(
						vscode.l10n.t('Extraction failed: {0}', messages),
					);
					return;
				}

				for (const warning of result.warnings) {
					deps.notifier.showWarning(warning);
				}

				if (result.colors.length === 0) {
					deps.notifier.showInfo(
						vscode.l10n.t('No colors found in the current document'),
					);
					return;
				}

				// Output colors in original format (Zero Hassle)
				let formattedColors: readonly string[] = result.colors.map(
					(color) => color.value,
				);
				if (config.dedupeEnabled) {
					formattedColors = dedupeColors(formattedColors);
				}

				const content = formattedColors.join('\n');
				const delivered = await deliverResults(
					content,
					document,
					config,
					deps.notifier,
				);

				const copiedToClipboard = config.copyToClipboardEnabled
					? await copyResults(content, result.colors.length, deps.notifier)
					: false;

				if (!config.copyToClipboardEnabled && delivered) {
					deps.notifier.showInfo(
						vscode.l10n.t('Extracted {0} colors', result.colors.length),
					);
				}

				// The clipboard is the documented fallback when the editor route
				// fails, so a successful copy still counts as delivery.
				if (!delivered && !copiedToClipboard) {
					return;
				}

				deps.telemetry.event('extract-success', {
					count: result.colors.length,
					fileType: result.metadata?.fileType,
					processingTimeMs: result.metadata?.processingTimeMs,
					warnings: result.warnings.length,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Unknown error occurred';
				deps.notifier.showError(
					`Color extraction failed: ${sanitizeErrorMessage(message)}`,
				);
				deps.telemetry.event('extract-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		},
	);

	context.subscriptions.push(command);
}
