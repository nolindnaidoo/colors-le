import * as vscode from 'vscode';
import { getContrastRatio } from '../conversion/colorConverter';
import { extractColors } from '../extraction/extract';
import type { Color } from '../types';
import { isValidColorFormat } from '../utils/colorConversion';
import { promptForValidationOptions } from './validatePrompts';

import type {
	ColorValidationOptions,
	ColorValidationResult,
	ValidationIssue,
	ValidationReport,
} from './validateTypes';

// Re-exported so validate.ts stays the public face of the command; the split
// into validateTypes/validatePrompts is an internal arrangement.
export type * from './validateTypes';

import {
	checkAccessibilityIssues,
	checkColorBlindnessIssues,
	generateValidationReport,
} from './validateReport';

/**
 * Register the validate colors command
 */
export function registerValidateCommand(
	context: vscode.ExtensionContext,
): void {
	const disposable = vscode.commands.registerCommand(
		'colors-le.validate',
		async () => {
			try {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					await vscode.window.showWarningMessage('No active editor found');
					return;
				}

				const startTime = performance.now();

				// Extract colors first
				const result = await extractColors(
					editor.document.getText(),
					editor.document.languageId,
				);

				if (!result.success || result.colors.length === 0) {
					await vscode.window.showInformationMessage(
						'No colors found to validate',
					);
					return;
				}

				// Prompt user for validation options
				const options = await promptForValidationOptions();
				if (!options) {
					return; // User cancelled
				}

				// Validate colors
				const validationReport = validateColors(result.colors, options);
				const durationMs = performance.now() - startTime;

				// Generate validation report
				const report = generateValidationReport(validationReport, durationMs);

				// Create and show validation document
				const doc = await vscode.workspace.openTextDocument({
					content: report,
					language: 'markdown',
				});

				await vscode.window.showTextDocument(doc, {
					viewColumn: vscode.ViewColumn.Beside,
					preview: false,
				});

				const { valid, invalid, errors, warnings } = validationReport.summary;

				await vscode.window.showInformationMessage(
					`Color validation completed. ${valid.toString()} valid, ${invalid.toString()} invalid, ${errors.toString()} errors, ${warnings.toString()} warnings.`,
				);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown error';
				await vscode.window.showErrorMessage(
					`Validation failed: ${errorMessage}`,
				);
			}
		},
	);

	context.subscriptions.push(disposable);
}

/**
 * Validate colors based on options
 */
export function validateColors(
	colors: readonly Color[],
	options: ColorValidationOptions,
): ValidationReport {
	const results: ColorValidationResult[] = [];

	for (const color of colors) {
		const issues: ValidationIssue[] = [];
		const suggestions: string[] = [];
		let contrastRatio: number | undefined;
		let accessibilityLevel: 'AA' | 'AAA' | 'fail' | undefined;

		// Format validation
		if (options.checkFormat) {
			if (!isValidColorFormat(color.value)) {
				issues.push({
					type: 'format',
					severity: 'error',
					message: `Invalid color format: ${color.value}`,
					suggestion: 'Use a valid color format (hex, rgb, hsl, etc.)',
				});
			}

			if (
				options.allowedFormats &&
				!options.allowedFormats.includes(color.format)
			) {
				issues.push({
					type: 'format',
					severity: 'warning',
					message: `Format ${color.format.toUpperCase()} not in allowed formats`,
					suggestion: `Use one of: ${options.allowedFormats
						.map((f) => f.toUpperCase())
						.join(', ')}`,
				});
			}
		}

		// Contrast validation
		if (options.checkContrast && options.contrastBackground) {
			try {
				contrastRatio = getContrastRatio(
					color.value,
					options.contrastBackground,
				);

				if (options.minContrastAA && contrastRatio < options.minContrastAA) {
					issues.push({
						type: 'contrast',
						severity: 'warning',
						message: `Contrast ratio ${contrastRatio.toFixed(2)}:1 fails WCAG AA (minimum ${
							options.minContrastAA
						}:1)`,
						suggestion:
							'Increase contrast by making the color darker or lighter',
					});
					accessibilityLevel = 'fail';
				}
				if (options.minContrastAA && contrastRatio >= options.minContrastAA) {
					accessibilityLevel = 'AA';
				}

				const failsAAA = Boolean(
					options.minContrastAAA && contrastRatio < options.minContrastAAA,
				);
				if (failsAAA && accessibilityLevel !== 'fail') {
					issues.push({
						type: 'contrast',
						severity: 'info',
						message: `Contrast ratio ${contrastRatio.toFixed(2)}:1 fails WCAG AAA (minimum ${
							options.minContrastAAA
						}:1)`,
						suggestion: 'For AAA compliance, increase contrast further',
					});
				}
				if (options.minContrastAAA && contrastRatio >= options.minContrastAAA) {
					accessibilityLevel = 'AAA';
				}
			} catch {
				issues.push({
					type: 'contrast',
					severity: 'error',
					message: 'Unable to calculate contrast ratio',
					suggestion: 'Ensure both colors are in valid formats',
				});
			}
		}

		// Accessibility validation
		if (options.checkAccessibility) {
			const accessibilityIssues = checkAccessibilityIssues(color.value);
			issues.push(...accessibilityIssues);
		}

		// Color blindness validation
		if (options.checkColorBlindness) {
			const colorBlindnessIssues = checkColorBlindnessIssues(color.value);
			issues.push(...colorBlindnessIssues);
		}

		// Custom rules
		if (options.customRules) {
			for (const rule of options.customRules) {
				try {
					if (rule.test(color.value)) continue;
					issues.push({
						type: 'custom',
						severity: rule.severity,
						message: `${rule.name}: ${rule.description}`,
						suggestion: rule.suggestion,
					});
				} catch {
					// Ignore rule errors
				}
			}
		}

		// Generate suggestions
		if (issues.length > 0) {
			const uniqueSuggestions = [
				...new Set(
					issues
						.map((i) => i.suggestion)
						.filter((s): s is string => Boolean(s)),
				),
			];
			suggestions.push(...uniqueSuggestions);
		}

		results.push(
			Object.freeze({
				color,
				valid: issues.filter((i) => i.severity === 'error').length === 0,
				issues: Object.freeze(issues),
				suggestions: Object.freeze(suggestions),
				contrastRatio,
				accessibilityLevel,
			}),
		);
	}

	const summary = {
		total: results.length,
		valid: results.filter((r) => r.valid).length,
		invalid: results.filter((r) => !r.valid).length,
		warnings: results.reduce(
			(sum, r) => sum + r.issues.filter((i) => i.severity === 'warning').length,
			0,
		),
		errors: results.reduce(
			(sum, r) => sum + r.issues.filter((i) => i.severity === 'error').length,
			0,
		),
	};

	return Object.freeze({
		colors: Object.freeze(results),
		summary: Object.freeze(summary),
		options,
		timestamp: Date.now(),
	});
}
