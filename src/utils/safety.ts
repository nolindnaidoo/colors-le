import * as vscode from 'vscode';
import type { Configuration } from '../types';

export interface SafetyResult {
	readonly proceed: boolean;
	readonly message: string;
	readonly warnings: readonly string[];
}

export interface SafetyCheckOptions {
	readonly allowOverride?: boolean;
	readonly customThresholds?: {
		readonly fileSizeBytes?: number;
		readonly lineCount?: number;
	};
}

export function handleSafetyChecks(
	document: vscode.TextDocument,
	config: Configuration,
	options: SafetyCheckOptions = {},
): SafetyResult {
	if (!config.safetyEnabled) {
		return Object.freeze({
			proceed: true,
			message: '',
			warnings: Object.freeze([]),
		});
	}

	const content = document.getText();
	const fileSizeThreshold =
		options.customThresholds?.fileSizeBytes ?? config.safetyFileSizeWarnBytes;

	if (content.length > fileSizeThreshold) {
		return Object.freeze({
			proceed: false,
			message: vscode.l10n.t(
				'File size ({0} bytes) exceeds the safety threshold ({1} bytes)',
				content.length,
				fileSizeThreshold,
			),
			warnings: Object.freeze([]),
		});
	}

	const warnings = collectSafetyWarnings(content, config, options);
	const message =
		warnings.length > 0
			? vscode.l10n.t(
					'Safety checks passed with {0} warning(s)',
					warnings.length,
				)
			: vscode.l10n.t('Safety checks passed');

	return Object.freeze({
		proceed: true,
		message,
		warnings: Object.freeze(warnings),
	});
}

function collectSafetyWarnings(
	content: string,
	config: Configuration,
	options: SafetyCheckOptions,
): string[] {
	const warnings: string[] = [];
	const lines = content.split('\n');
	const lineCountThreshold =
		options.customThresholds?.lineCount ??
		config.safetyLargeOutputLinesThreshold;

	if (lines.length > lineCountThreshold) {
		warnings.push(
			vscode.l10n.t(
				'Large file detected: {0} lines (threshold: {1})',
				lines.length,
				lineCountThreshold,
			),
		);
	}

	const estimatedColors = estimateColorCount(content);
	if (estimatedColors > 1000) {
		warnings.push(
			vscode.l10n.t(
				'Large number of colors detected: an estimated {0}',
				estimatedColors,
			),
		);
	}

	return warnings;
}

export async function handleSafetyChecksWithUserConfirmation(
	document: vscode.TextDocument,
	config: Configuration,
	options: SafetyCheckOptions = {},
): Promise<SafetyResult> {
	const result = handleSafetyChecks(document, config, options);

	if (result.proceed || options.allowOverride !== true) {
		return result;
	}

	// Bound once and compared below: the dialog returns the clicked label,
	// so an English literal would read every translated click as Cancel.
	const continueLabel = vscode.l10n.t('Continue Anyway');
	const userChoice = await vscode.window.showWarningMessage(
		result.message,
		{
			modal: true,
			detail: vscode.l10n.t(
				'This operation may take a long time or consume significant resources. Do you want to continue?',
			),
		},
		continueLabel,
		vscode.l10n.t('Cancel'),
	);

	if (userChoice !== continueLabel) {
		return result;
	}

	return Object.freeze({
		...result,
		proceed: true,
		message: vscode.l10n.t('Safety override approved by user'),
	});
}

function estimateColorCount(content: string): number {
	const hex = content.match(/#[0-9a-f]{3,8}/gi)?.length ?? 0;
	const functional = content.match(/\b(?:rgba?|hsla?)\([^)]*\)/gi)?.length ?? 0;
	return hex + functional;
}
