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
			message: `File size (${content.length} bytes) exceeds safety threshold (${fileSizeThreshold} bytes)`,
			warnings: Object.freeze([]),
		});
	}

	const warnings = collectSafetyWarnings(content, config, options);
	const message =
		warnings.length > 0
			? `Safety checks passed with ${warnings.length} warnings`
			: 'Safety checks passed';

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
			`Large file detected: ${lines.length} lines (threshold: ${lineCountThreshold})`,
		);
	}

	const estimatedColors = estimateColorCount(content);
	if (estimatedColors > 1000) {
		warnings.push(
			`Large number of colors detected: estimated ${estimatedColors} colors`,
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

	const continueLabel = 'Continue Anyway';
	const userChoice = await vscode.window.showWarningMessage(
		result.message,
		{
			modal: true,
			detail:
				'This operation may take a long time or consume significant resources. Do you want to continue?',
		},
		continueLabel,
		'Cancel',
	);

	if (userChoice !== continueLabel) {
		return result;
	}

	return Object.freeze({
		...result,
		proceed: true,
		message: 'Safety override approved by user',
	});
}

function estimateColorCount(content: string): number {
	const hex = content.match(/#[0-9a-f]{3,8}/gi)?.length ?? 0;
	const functional = content.match(/\b(?:rgba?|hsla?)\([^)]*\)/gi)?.length ?? 0;
	return hex + functional;
}
