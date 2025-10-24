import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { getConfiguration } from '../config/config';
import { type ExtractionOptions, extractColors } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import {
	createEnhancedError,
	createErrorSummary,
	formatErrorSummary,
} from '../utils/errorHandling';
import {
	handleSafetyChecksWithUserConfirmation,
	type SafetyCheckOptions,
} from '../utils/safety';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

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
				const error = createEnhancedError(
					new Error(
						localize('runtime.extract.no-editor', 'No active editor found'),
					),
					'operational',
					{},
					{
						recoverable: false,
						severity: 'low',
						suggestion: localize(
							'runtime.extract.no-editor.suggestion',
							'Open a file to extract colors from',
						),
					},
				);
				await deps.notifier.showEnhancedError(error);
				return;
			}

			const document = editor.document;
			const config = getConfiguration();

			// Enhanced safety checks with user confirmation
			const safetyOptions: SafetyCheckOptions = {
				showProgress: true,
				allowOverride: true,
				customThresholds: {
					fileSizeBytes: config.safetyFileSizeWarnBytes,
					lineCount: config.safetyLargeOutputLinesThreshold,
				},
			};

			const safetyResult = await handleSafetyChecksWithUserConfirmation(
				document,
				config,
				safetyOptions,
			);
			if (!safetyResult.proceed) {
				if (safetyResult.error) {
					await deps.notifier.showEnhancedError(safetyResult.error);
				} else {
					deps.notifier.showWarning(safetyResult.message);
				}
				return;
			}

			// Show warnings if any
			if (safetyResult.warnings.length > 0) {
				for (const warning of safetyResult.warnings) {
					deps.notifier.showWarning(warning);
				}
			}

			try {
				// Enhanced extraction with progress and error handling
				const extractionOptions: ExtractionOptions = {
					filepath: document.fileName,
					showProgress: true,
					includeMetadata: true,
					maxColors: config.safetyManyDocumentsThreshold,
					timeoutMs: 30000, // 30 seconds
					enablePerformanceMonitoring: false,
				};

				const result = await deps.notifier.showProgress(
					localize('runtime.extract.progress', 'Extracting colors...'),
					async (
						progress: vscode.Progress<{ message?: string; increment?: number }>,
						token: vscode.CancellationToken,
					) => {
						// Check for cancellation before starting
						if (token.isCancellationRequested) {
							throw new Error('Operation cancelled by user');
						}

						progress.report({
							message: localize(
								'runtime.extract.progress.analyzing',
								'Analyzing file...',
							),
						});

						const extractionResult = await extractColors(
							document.getText(),
							document.languageId,
							extractionOptions,
						);

						// Check for cancellation after extraction
						if (token.isCancellationRequested) {
							throw new Error('Operation cancelled by user');
						}

						progress.report({
							message: localize(
								'runtime.extract.progress.formatting',
								'Formatting results...',
							),
							increment: 50,
						});

						return extractionResult;
					},
				);

				// Handle extraction errors
				if (!result.success && result.errors.length > 0) {
					const enhancedErrors = result.errors.map((error) =>
						createEnhancedError(
							new Error(error.message),
							error.type === 'parse-error' ? 'parse' : 'validation',
							{ filepath: error.filepath },
							{
								recoverable: true,
								severity: 'medium',
							},
						),
					);

					const errorSummary = createErrorSummary(enhancedErrors);
					deps.notifier.showErrorSummary(errorSummary);

					// Show detailed error summary in output
					const summaryText = formatErrorSummary(errorSummary);
					console.log(summaryText);

					return;
				}

				// Handle warnings
				if (result.warnings && result.warnings.length > 0) {
					for (const warning of result.warnings) {
						deps.notifier.showWarning(warning);
					}
				}

				if (result.colors.length === 0) {
					deps.notifier.showInfo(
						localize(
							'runtime.extract.no-colors',
							'No colors found in the current document',
						),
					);
					return;
				}

				// Output colors in original format (Zero Hassle)
				const formattedColors = result.colors.map((color) => color.value);

				// Open results with enhanced error handling
				try {
					if (config.openResultsSideBySide) {
						const doc = await vscode.workspace.openTextDocument({
							content: formattedColors.join('\n'),
							language: 'plaintext',
						});
						await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
					} else {
						// Replace current selection or entire document
						const edit = new vscode.WorkspaceEdit();
						edit.replace(
							document.uri,
							new vscode.Range(0, 0, document.lineCount, 0),
							formattedColors.join('\n'),
						);
						await vscode.workspace.applyEdit(edit);
					}
				} catch (error) {
					const enhancedError = createEnhancedError(
						error instanceof Error
							? error
							: new Error('Failed to open results'),
						'operational',
						{ resultCount: result.colors.length },
						{
							recoverable: true,
							severity: 'medium',
							suggestion: localize(
								'runtime.extract.open-results.suggestion',
								'Try copying results to clipboard instead',
							),
						},
					);
					await deps.notifier.showEnhancedError(enhancedError);
				}

				// Copy to clipboard if enabled
				if (config.copyToClipboardEnabled) {
					try {
						const clipboardText = formattedColors.join('\n');
						// Check clipboard text length to prevent memory issues
						if (clipboardText.length > 1000000) {
							// 1MB limit
							deps.notifier.showWarning(
								localize(
									'runtime.extract.clipboard.too-large',
									'Results too large for clipboard ({0} characters), skipping clipboard copy',
									clipboardText.length,
								),
							);
						} else {
							await vscode.env.clipboard.writeText(clipboardText);
							deps.notifier.showInfo(
								localize(
									'runtime.extract.success.clipboard',
									'Extracted {0} colors and copied to clipboard',
									result.colors.length,
								),
							);
						}
					} catch (error) {
						const enhancedError = createEnhancedError(
							error instanceof Error
								? error
								: new Error('Failed to copy to clipboard'),
							'operational',
							{ resultCount: result.colors.length },
							{
								recoverable: true,
								severity: 'low',
								suggestion: localize(
									'runtime.extract.clipboard.suggestion',
									'Results are displayed in the editor',
								),
							},
						);
						await deps.notifier.showEnhancedError(enhancedError);
					}
				} else {
					deps.notifier.showInfo(
						localize(
							'runtime.extract.success',
							'Extracted {0} colors',
							result.colors.length,
						),
					);
				}

				// Enhanced telemetry with performance metrics
				deps.telemetry.event('extract-success', {
					count: result.colors.length,
					fileType: result.metadata?.fileType,
					processingTimeMs: result.metadata?.processingTimeMs,
					warnings: result.warnings?.length || 0,
					performanceMetrics: result.metadata?.performanceMetrics,
				});
			} catch (error) {
				const enhancedError = createEnhancedError(
					error instanceof Error
						? error
						: new Error(
								localize(
									'runtime.error.unknown-fallback',
									'Unknown error occurred',
								),
							),
					'operational',
					{ fileName: document.fileName, languageId: document.languageId },
					{
						recoverable: true,
						severity: 'high',
						suggestion: localize(
							'runtime.extract.error.suggestion',
							'Try with a smaller file or check file syntax',
						),
					},
				);

				await deps.notifier.showEnhancedError(enhancedError);
				deps.telemetry.event('extract-error', {
					error: enhancedError.userMessage,
					severity: enhancedError.severity,
				});
			} finally {
				deps.statusBar.hideProgress();
			}
		},
	);

	context.subscriptions.push(command);
}

void localize;
