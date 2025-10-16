import * as vscode from 'vscode';
import { getContrastRatio } from '../conversion/colorConverter';
import { extractColors } from '../extraction/extract';
import type { Color } from '../types';
import { createLocalizer } from '../utils/localization';
import { formatDuration } from '../utils/performance';

export interface ColorValidationOptions {
	readonly checkContrast?: boolean | undefined;
	readonly contrastBackground?: string | undefined;
	readonly minContrastAA?: number | undefined;
	readonly minContrastAAA?: number | undefined;
	readonly checkFormat?: boolean | undefined;
	readonly checkAccessibility?: boolean | undefined;
	readonly checkColorBlindness?: boolean | undefined;
	readonly allowedFormats?: readonly string[] | undefined;
	readonly customRules?: readonly ValidationRule[] | undefined;
}

export interface ValidationRule {
	readonly name: string;
	readonly description: string;
	readonly test: (color: string) => boolean;
	readonly severity: 'error' | 'warning' | 'info';
	readonly suggestion?: string | undefined;
}

export interface ColorValidationResult {
	readonly color: Color;
	readonly valid: boolean;
	readonly issues: readonly ValidationIssue[];
	readonly suggestions: readonly string[];
	readonly contrastRatio?: number | undefined;
	readonly accessibilityLevel?: 'AA' | 'AAA' | 'fail' | undefined;
}

export interface ValidationIssue {
	readonly type: 'format' | 'contrast' | 'accessibility' | 'custom';
	readonly severity: 'error' | 'warning' | 'info';
	readonly message: string;
	readonly suggestion?: string | undefined;
}

export interface ValidationReport {
	readonly colors: readonly ColorValidationResult[];
	readonly summary: {
		readonly total: number;
		readonly valid: number;
		readonly invalid: number;
		readonly warnings: number;
		readonly errors: number;
	};
	readonly options: ColorValidationOptions;
	readonly timestamp: number;
}

interface ValidateDeps {
	readonly performanceMonitor: {
		startTimer: (operation: string) => { id: string; startTime: number };
		endTimer: (timer: { id: string; startTime: number }) => {
			duration: number;
			memoryUsage: number;
		};
	};
}

/**
 * Register the validate colors command
 */
export function registerValidateCommand(
	context: vscode.ExtensionContext,
	deps: ValidateDeps,
): void {
	const disposable = vscode.commands.registerCommand(
		'colors-le.validate',
		async () => {
			const localizer = createLocalizer();

			try {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					await vscode.window.showWarningMessage(
						localizer.localize(
							'runtime.error.no-active-editor',
							'No active editor found',
						),
					);
					return;
				}

				const timer = deps.performanceMonitor.startTimer('validate-colors');

				// Extract colors first
				const result = await extractColors(
					editor.document.getText(),
					editor.document.fileName,
				);

				if (!result.success || result.colors.length === 0) {
					await vscode.window.showInformationMessage(
						localizer.localize(
							'runtime.validate.no-colors',
							'No colors found to validate',
						),
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
				const metrics = deps.performanceMonitor.endTimer(timer);

				// Generate validation report
				const report = generateValidationReport(validationReport, metrics);

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
					localizer.localize(
						'runtime.validate.success',
						'Color validation completed. {0} valid, {1} invalid, {2} errors, {3} warnings.',
						valid.toString(),
						invalid.toString(),
						errors.toString(),
						warnings.toString(),
					),
				);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown error';
				await vscode.window.showErrorMessage(
					localizer.localize(
						'runtime.validate.error',
						'Validation failed: {0}',
						errorMessage,
					),
				);
			}
		},
	);

	context.subscriptions.push(disposable);
}

/**
 * Prompt user for validation options
 */
async function promptForValidationOptions(): Promise<
	ColorValidationOptions | undefined
> {
	const options: {
		checkContrast?: boolean | undefined;
		contrastBackground?: string | undefined;
		minContrastAA?: number | undefined;
		minContrastAAA?: number | undefined;
		checkFormat?: boolean | undefined;
		checkAccessibility?: boolean | undefined;
		checkColorBlindness?: boolean | undefined;
		allowedFormats?: readonly string[] | undefined;
		customRules?: readonly ValidationRule[] | undefined;
	} = {};

	// Basic validation checks
	const basicChecks = await vscode.window.showQuickPick(
		[
			{
				label: 'Format validation',
				description: 'Check color format validity',
				picked: true,
			},
			{
				label: 'Accessibility validation',
				description: 'Check accessibility compliance',
				picked: true,
			},
			{
				label: 'Contrast validation',
				description: 'Check contrast ratios',
				picked: false,
			},
			{
				label: 'Color blindness check',
				description: 'Check color blindness compatibility',
				picked: false,
			},
		],
		{
			placeHolder: 'Select validation checks',
			canPickMany: true,
		},
	);

	if (basicChecks === undefined) return undefined;

	options.checkFormat = basicChecks.some(
		(c) => c.label === 'Format validation',
	);
	options.checkAccessibility = basicChecks.some(
		(c) => c.label === 'Accessibility validation',
	);
	options.checkContrast = basicChecks.some(
		(c) => c.label === 'Contrast validation',
	);
	options.checkColorBlindness = basicChecks.some(
		(c) => c.label === 'Color blindness check',
	);

	// Contrast validation options
	if (options.checkContrast) {
		const background = await vscode.window.showInputBox({
			prompt: 'Background color for contrast checking (default: #ffffff)',
			value: '#ffffff',
			validateInput: (value) => {
				return isValidColorFormat(value)
					? undefined
					: 'Enter a valid color (hex, rgb, hsl, etc.)';
			},
		});

		if (background === undefined) return undefined;
		options.contrastBackground = background;

		const contrastLevel = await vscode.window.showQuickPick(
			[
				{
					label: 'WCAG AA',
					description: 'Minimum 4.5:1 for normal text, 3:1 for large text',
					value: 'AA',
				},
				{
					label: 'WCAG AAA',
					description: 'Minimum 7:1 for normal text, 4.5:1 for large text',
					value: 'AAA',
				},
				{
					label: 'Custom',
					description: 'Specify custom contrast ratios',
					value: 'custom',
				},
			],
			{
				placeHolder: 'Select contrast level',
			},
		);

		if (contrastLevel === undefined) return undefined;

		if (contrastLevel.value === 'AA') {
			options.minContrastAA = 4.5;
		} else if (contrastLevel.value === 'AAA') {
			options.minContrastAAA = 7.0;
		} else if (contrastLevel.value === 'custom') {
			const minAA = await vscode.window.showInputBox({
				prompt: 'Minimum contrast ratio for AA compliance',
				value: '4.5',
				validateInput: (value) => {
					const num = Number.parseFloat(value);
					return Number.isNaN(num) || num <= 0
						? 'Enter a positive number'
						: undefined;
				},
			});

			if (minAA === undefined) return undefined;
			options.minContrastAA = Number.parseFloat(minAA);

			const minAAA = await vscode.window.showInputBox({
				prompt: 'Minimum contrast ratio for AAA compliance',
				value: '7.0',
				validateInput: (value) => {
					const num = Number.parseFloat(value);
					return Number.isNaN(num) || num <= 0
						? 'Enter a positive number'
						: undefined;
				},
			});

			if (minAAA === undefined) return undefined;
			options.minContrastAAA = Number.parseFloat(minAAA);
		}
	}

	// Format restrictions
	if (options.checkFormat) {
		const formatRestriction = await vscode.window.showQuickPick(
			[
				{
					label: 'Allow all formats',
					description: 'No format restrictions',
					value: 'all',
				},
				{
					label: 'Hex only',
					description: 'Only allow hexadecimal colors',
					value: 'hex',
				},
				{
					label: 'RGB/RGBA only',
					description: 'Only allow RGB functional notation',
					value: 'rgb',
				},
				{
					label: 'HSL/HSLA only',
					description: 'Only allow HSL functional notation',
					value: 'hsl',
				},
				{
					label: 'Custom selection',
					description: 'Choose specific formats',
					value: 'custom',
				},
			],
			{
				placeHolder: 'Format restrictions',
			},
		);

		if (formatRestriction === undefined) return undefined;

		switch (formatRestriction.value) {
			case 'hex':
				options.allowedFormats = ['hex'];
				break;
			case 'rgb':
				options.allowedFormats = ['rgb', 'rgba'];
				break;
			case 'hsl':
				options.allowedFormats = ['hsl', 'hsla'];
				break;
			case 'custom': {
				const selectedFormats = await vscode.window.showQuickPick(
					[
						{ label: 'HEX', description: '#ff0000', picked: true },
						{ label: 'RGB', description: 'rgb(255, 0, 0)', picked: true },
						{ label: 'RGBA', description: 'rgba(255, 0, 0, 1)', picked: true },
						{ label: 'HSL', description: 'hsl(0, 100%, 50%)', picked: true },
						{
							label: 'HSLA',
							description: 'hsla(0, 100%, 50%, 1)',
							picked: true,
						},
						{ label: 'Named', description: 'red, blue, etc.', picked: true },
					],
					{
						placeHolder: 'Select allowed formats',
						canPickMany: true,
					},
				);

				if (selectedFormats === undefined) return undefined;
				options.allowedFormats = selectedFormats.map((f) =>
					f.label.toLowerCase(),
				);
				break;
			}
		}
	}

	return options as ColorValidationOptions;
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
				...new Set(issues.map((i) => i.suggestion).filter(Boolean)),
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
	metrics: { duration: number; memoryUsage: number },
): string {
	const lines: string[] = [];

	// Header
	lines.push('# Color Validation Report');
	lines.push('');
	lines.push(`**Generated**: ${new Date().toISOString()}`);
	lines.push(`**Validation Time**: ${formatDuration(metrics.duration)}`);
	lines.push(`**Memory Usage**: ${formatMemoryUsage(metrics.memoryUsage)}`);
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

function isValidColorFormat(color: string): boolean {
	const patterns = [
		/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
		/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i,
		/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/i,
		/^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/i,
		/^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)$/i,
	];

	return patterns.some((pattern) => pattern.test(color));
}

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

function parseColorToHSL(
	color: string,
): { h: number; s: number; l: number } | null {
	// Reuse HSL parsing logic from filter.ts
	const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex) {
		return hexToHSL(color);
	}

	const hsl = color.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/i);
	if (hsl) {
		return {
			h: Number.parseInt(hsl[1], 10),
			s: Number.parseInt(hsl[2], 10),
			l: Number.parseInt(hsl[3], 10),
		};
	}

	return null;
}

function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) return null;

	const r = Number.parseInt(result[1], 16) / 255;
	const g = Number.parseInt(result[2], 16) / 255;
	const b = Number.parseInt(result[3], 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max === min) {
		h = s = 0; // achromatic
	} else {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	return {
		h: Math.round(h * 360),
		s: Math.round(s * 100),
		l: Math.round(l * 100),
	};
}

function formatMemoryUsage(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
