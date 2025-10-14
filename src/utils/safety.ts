import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import type { Configuration } from '../types';
import { createEnhancedError, type EnhancedError } from './errorHandling';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export interface SafetyResult {
	readonly proceed: boolean;
	readonly message: string;
	readonly error?: EnhancedError;
	readonly warnings: readonly string[];
}

export interface SafetyCheckOptions {
	readonly showProgress?: boolean;
	readonly allowOverride?: boolean;
	readonly customThresholds?: {
		readonly fileSizeBytes?: number;
		readonly lineCount?: number;
		readonly colorCount?: number;
	};
}

export function handleSafetyChecks(
	document: vscode.TextDocument,
	config: Configuration,
	options: SafetyCheckOptions = {},
): SafetyResult {
	if (!config.safetyEnabled) {
		return { proceed: true, message: '', warnings: [] };
	}

	const content = document.getText();
	const lines = content.split('\n');
	const warnings: string[] = [];

	// Use custom thresholds if provided, otherwise use config
	const fileSizeThreshold =
		options.customThresholds?.fileSizeBytes ?? config.safetyFileSizeWarnBytes;
	const lineCountThreshold =
		options.customThresholds?.lineCount ??
		config.safetyLargeOutputLinesThreshold;

	// Check file size
	if (content.length > fileSizeThreshold) {
		const error = createEnhancedError(
			new Error(
				localize(
					'runtime.safety.file-size',
					'File size ({0} bytes) exceeds safety threshold ({1} bytes)',
					content.length,
					fileSizeThreshold,
				),
			),
			'safety',
			{
				fileSize: content.length,
				threshold: fileSizeThreshold,
				fileName: document.fileName,
			},
			{
				recoverable: false,
				severity: 'high',
				suggestion: localize(
					'runtime.safety.file-size.suggestion',
					'Consider splitting the file or increasing the safety threshold in settings',
				),
			},
		);

		return {
			proceed: false,
			message: error.userMessage,
			error,
			warnings: [],
		};
	}

	// Check line count
	if (lines.length > lineCountThreshold) {
		warnings.push(
			localize(
				'runtime.safety.line-count.warning',
				'Large file detected: {0} lines (threshold: {1})',
				lines.length,
				lineCountThreshold,
			),
		);
	}

	// Check for potential performance issues
	const estimatedColors = estimateColorCount(content);
	if (estimatedColors > 1000) {
		warnings.push(
			localize(
				'runtime.safety.color-count.warning',
				'Large number of colors detected: estimated {0} colors',
				estimatedColors,
			),
		);
	}

	// Check for complex CSS patterns that might be slow to parse
	const complexPatterns = countComplexPatterns(content);
	if (complexPatterns > 100) {
		warnings.push(
			localize(
				'runtime.safety.complex-patterns.warning',
				'Complex CSS patterns detected: {0} patterns',
				complexPatterns,
			),
		);
	}

	return {
		proceed: true,
		message:
			warnings.length > 0
				? localize(
						'runtime.safety.warnings',
						'Safety checks passed with {0} warnings',
						warnings.length,
					)
				: localize('runtime.safety.passed', 'Safety checks passed'),
		warnings: Object.freeze(warnings),
	};
}

export async function handleSafetyChecksWithUserConfirmation(
	document: vscode.TextDocument,
	config: Configuration,
	options: SafetyCheckOptions = {},
): Promise<SafetyResult> {
	const result = handleSafetyChecks(document, config, options);

	if (!result.proceed && options.allowOverride) {
		const override = await vscode.window.showWarningMessage(
			result.message,
			{
				modal: true,
				detail: localize(
					'runtime.safety.override.detail',
					'This operation may take a long time or consume significant resources. Do you want to continue?',
				),
			},
			localize('runtime.safety.override.continue', 'Continue Anyway'),
			localize('runtime.safety.override.cancel', 'Cancel'),
		);

		if (
			override ===
			localize('runtime.safety.override.continue', 'Continue Anyway')
		) {
			return {
				...result,
				proceed: true,
				message: localize(
					'runtime.safety.override.approved',
					'Safety override approved by user',
				),
			};
		}
	}

	return result;
}

/**
 * Estimate the number of colors in the content
 */
function estimateColorCount(content: string): number {
	// Simple heuristic based on common color patterns
	const hexColors = (content.match(/#[0-9a-fA-F]{3,8}/g) || []).length;
	const rgbColors = (content.match(/rgb\([^)]+\)/g) || []).length;
	const rgbaColors = (content.match(/rgba\([^)]+\)/g) || []).length;
	const hslColors = (content.match(/hsl\([^)]+\)/g) || []).length;
	const hslaColors = (content.match(/hsla\([^)]+\)/g) || []).length;

	return hexColors + rgbColors + rgbaColors + hslColors + hslaColors;
}

/**
 * Count complex CSS patterns that might be slow to parse
 */
function countComplexPatterns(content: string): number {
	// Count complex selectors, nested rules, etc.
	const complexSelectors = (content.match(/[.#][^{]*\{[^}]*\{/g) || []).length;
	const mediaQueries = (content.match(/@media[^{]*\{/g) || []).length;
	const keyframes = (content.match(/@keyframes[^{]*\{/g) || []).length;
	const functions = (content.match(/@function[^{]*\{/g) || []).length;
	const mixins = (content.match(/@mixin[^{]*\{/g) || []).length;

	return complexSelectors + mediaQueries + keyframes + functions + mixins;
}

/**
 * Check if operation should be cancelled based on safety thresholds
 */
export function shouldCancelOperation(
	processedItems: number,
	threshold: number,
	startTime: number,
	maxTimeMs: number = 30000, // 30 seconds
): boolean {
	const elapsedTime = Date.now() - startTime;

	return processedItems > threshold || elapsedTime > maxTimeMs;
}

/**
 * Create safety warning for display
 */
export function createSafetyWarning(
	message: string,
	details: Record<string, unknown> = {},
): EnhancedError {
	return createEnhancedError(new Error(message), 'safety', details, {
		severity: 'medium',
		recoverable: true,
		suggestion: localize(
			'runtime.safety.warning.suggestion',
			'Consider adjusting safety settings or breaking down the operation',
		),
	});
}

void localize;
