import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import { extractColors } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { dedupeColors } from '../utils/dedupe';
import { sanitizeErrorMessage } from '../utils/errors';
import { handleSafetyChecksWithUserConfirmation } from '../utils/safety';

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

				// Whether the results actually reached the user. A failed open, or
				// an edit the workspace rejected, used to be reported as an error
				// and then followed by "Extracted N colors" anyway — a failure and
				// a success for the same action.
				let delivered = true;
				try {
					if (config.openResultsSideBySide) {
						const doc = await vscode.workspace.openTextDocument({
							content: formattedColors.join('\n'),
							language: 'plaintext',
						});
						await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
					} else {
						const edit = new vscode.WorkspaceEdit();
						edit.replace(
							document.uri,
							new vscode.Range(
								document.positionAt(0),
								document.lineAt(document.lineCount - 1).range.end,
							),
							formattedColors.join('\n'),
						);
						// applyEdit resolves false for a read-only document, or one
						// that changed underneath the command.
						const applied = await vscode.workspace.applyEdit(edit);
						if (!applied) {
							delivered = false;
							deps.notifier.showError(
								vscode.l10n.t(
									'Could not replace the document contents: the edit was rejected.',
								),
							);
						}
					}
				} catch (error) {
					delivered = false;
					const message =
						error instanceof Error ? error.message : 'Failed to open results';
					deps.notifier.showError(
						`Failed to open results: ${sanitizeErrorMessage(message)}. Try copying results to clipboard instead.`,
					);
				}

				let copiedToClipboard = false;
				if (config.copyToClipboardEnabled) {
					const clipboardText = formattedColors.join('\n');
					if (clipboardText.length > 1000000) {
						deps.notifier.showWarning(
							`Results too large for clipboard (${clipboardText.length} characters), skipping clipboard copy`,
						);
					} else {
						// The results are already in an editor, so a clipboard that is
						// unavailable — a remote or headless session — is a warning, not
						// an "Extraction failed" for work that succeeded.
						try {
							await vscode.env.clipboard.writeText(clipboardText);
							copiedToClipboard = true;
							deps.notifier.showInfo(
								`Extracted ${result.colors.length} colors and copied to clipboard`,
							);
						} catch (error) {
							const message =
								error instanceof Error ? error.message : 'Unknown error';
							deps.notifier.showWarning(
								vscode.l10n.t(
									'Extracted the colors, but could not copy them to the clipboard: {0}',
									message,
								),
							);
						}
					}
				} else if (delivered) {
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
