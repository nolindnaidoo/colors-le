import * as vscode from 'vscode';
import { getContrastRatio } from '../conversion/colorConverter';
import { extractColors } from '../extraction/extract';
import type { Color } from '../types';
import { isValidColorFormat, parseColorToHSL } from '../utils/colorConversion';
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

import { formatDuration } from '../utils/format';

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
				} else if (
					options.minContrastAA &&
					contrastRatio >= options.minContrastAA
				) {
					accessibilityLevel = 'AA';
				}

				if (options.minContrastAAA && contrastRatio < options.minContrastAAA) {
					if (accessibilityLevel !== 'fail') {
						issues.push({
							type: 'contrast',
							severity: 'info',
							message: `Contrast ratio ${contrastRatio.toFixed(2)}:1 fails WCAG AAA (minimum ${
								options.minContrastAAA
							}:1)`,
							suggestion: 'For AAA compliance, increase contrast further',
						});
					}
				} else if (
					options.minContrastAAA &&
					contrastRatio >= options.minContrastAAA
				) {
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
					if (!rule.test(color.value)) {
						issues.push({
							type: 'custom',
							severity: rule.severity,
							message: `${rule.name}: ${rule.description}`,
							suggestion: rule.suggestion,
						});
					}
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

/**
 * Generate validation report
 */
function generateValidationReport(
	report: ValidationReport,
	durationMs: number,
): string {
	const lines: string[] = [];

	// Header
	lines.push('# Color Validation Report');
	lines.push('');
	lines.push(`**Generated**: ${new Date().toISOString()}`);
	lines.push(`**Validation Time**: ${formatDuration(durationMs)}`);
	lines.push('');

	// Summary
	lines.push('## Summary');
	lines.push('');
	lines.push(`- **Total Colors**: ${report.summary.total}`);
	lines.push(`- **Valid**: ${report.summary.valid}`);
	lines.push(`- **Invalid**: ${report.summary.invalid}`);
	lines.push(`- **Errors**: ${report.summary.errors}`);
	lines.push(`- **Warnings**: ${report.summary.warnings}`);
	lines.push(
		`- **Success Rate**: ${((report.summary.valid / report.summary.total) * 100).toFixed(1)}%`,
	);
	lines.push('');

	// Validation Options
	lines.push('## Validation Options');
	lines.push('');
	if (report.options.checkFormat)
		lines.push('- **Format Validation**: Enabled');
	if (report.options.checkAccessibility)
		lines.push('- **Accessibility Validation**: Enabled');
	if (report.options.checkContrast) {
		lines.push('- **Contrast Validation**: Enabled');
		if (report.options.contrastBackground) {
			lines.push(`  - Background: \`${report.options.contrastBackground}\``);
		}
		if (report.options.minContrastAA) {
			lines.push(`  - WCAG AA: ${report.options.minContrastAA}:1`);
		}
		if (report.options.minContrastAAA) {
			lines.push(`  - WCAG AAA: ${report.options.minContrastAAA}:1`);
		}
	}
	if (report.options.allowedFormats) {
		lines.push(
			`- **Allowed Formats**: ${report.options.allowedFormats
				.map((f) => f.toUpperCase())
				.join(', ')}`,
		);
	}
	lines.push('');

	// Issues by Type
	const issuesByType = new Map<string, ValidationIssue[]>();
	for (const result of report.colors) {
		for (const issue of result.issues) {
			const key = `${issue.type}-${issue.severity}`;
			if (!issuesByType.has(key)) {
				issuesByType.set(key, []);
			}
			const issues = issuesByType.get(key);
			if (issues) {
				issues.push(issue);
			}
		}
	}

	if (issuesByType.size > 0) {
		lines.push('## Issues by Type');
		lines.push('');
		lines.push('| Type | Severity | Count |');
		lines.push('|------|----------|-------|');

		for (const [key, issues] of Array.from(issuesByType.entries()).sort()) {
			const [type, severity] = key.split('-');
			const icon =
				severity === 'error' ? '🔴' : severity === 'warning' ? '🟡' : '🔵';
			lines.push(`| ${icon} ${type} | ${severity} | ${issues.length} |`);
		}
		lines.push('');
	}

	// Detailed Results
	const invalidColors = report.colors.filter(
		(r) => !r.valid || r.issues.length > 0,
	);
	if (invalidColors.length > 0) {
		lines.push('## Detailed Results');
		lines.push('');

		for (const result of invalidColors) {
			const statusIcon = result.valid ? '🟡' : '🔴';
			lines.push(`### ${statusIcon} \`${result.color.value}\``);
			lines.push('');

			if (result.contrastRatio !== undefined) {
				lines.push(`**Contrast Ratio**: ${result.contrastRatio.toFixed(2)}:1`);
			}
			if (result.accessibilityLevel) {
				lines.push(`**Accessibility Level**: ${result.accessibilityLevel}`);
			}
			lines.push('');

			if (result.issues.length > 0) {
				lines.push('**Issues**:');
				for (const issue of result.issues) {
					const issueIcon =
						issue.severity === 'error'
							? '🔴'
							: issue.severity === 'warning'
								? '🟡'
								: '🔵';
					lines.push(`- ${issueIcon} ${issue.message}`);
				}
				lines.push('');
			}

			if (result.suggestions.length > 0) {
				lines.push('**Suggestions**:');
				for (const suggestion of result.suggestions) {
					lines.push(`- 💡 ${suggestion}`);
				}
				lines.push('');
			}
		}
	}

	// Valid Colors Summary
	const validColors = report.colors.filter(
		(r) => r.valid && r.issues.length === 0,
	);
	if (validColors.length > 0) {
		lines.push('## Valid Colors');
		lines.push('');
		lines.push(
			`✅ **${validColors.length} colors passed all validation checks**`,
		);
		lines.push('');
	}

	lines.push('---');
	lines.push('*Generated by Colors-LE Color Validation*');

	return lines.join('\n');
}

// Helper functions

function checkAccessibilityIssues(color: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	// Check for very light colors that might be hard to see
	const hsl = parseColorToHSL(color);
	if (hsl) {
		if (hsl.l > 95) {
			issues.push({
				type: 'accessibility',
				severity: 'warning',
				message: 'Very light color may be difficult to see',
				suggestion: 'Consider using a darker shade for better visibility',
			});
		}

		if (hsl.l < 5) {
			issues.push({
				type: 'accessibility',
				severity: 'warning',
				message: 'Very dark color may be difficult to see',
				suggestion: 'Consider using a lighter shade for better visibility',
			});
		}

		if (hsl.s < 5 && hsl.l > 40 && hsl.l < 60) {
			issues.push({
				type: 'accessibility',
				severity: 'info',
				message: 'Low saturation color may appear gray to some users',
				suggestion:
					'Consider increasing saturation for better color distinction',
			});
		}
	}

	return issues;
}

function checkColorBlindnessIssues(color: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	// Simplified color blindness checks
	const hsl = parseColorToHSL(color);
	if (hsl) {
		// Red-green color blindness issues
		if ((hsl.h >= 0 && hsl.h <= 30) || (hsl.h >= 330 && hsl.h <= 360)) {
			if (hsl.s > 50) {
				issues.push({
					type: 'accessibility',
					severity: 'info',
					message:
						'Red colors may be problematic for users with red-green color blindness',
					suggestion:
						'Consider using additional visual cues (patterns, shapes) alongside color',
				});
			}
		}

		if (hsl.h >= 90 && hsl.h <= 150 && hsl.s > 50) {
			issues.push({
				type: 'accessibility',
				severity: 'info',
				message:
					'Green colors may be problematic for users with red-green color blindness',
				suggestion:
					'Consider using additional visual cues (patterns, shapes) alongside color',
			});
		}
	}

	return issues;
}
