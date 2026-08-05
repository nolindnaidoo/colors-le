import * as vscode from 'vscode';
import { extractColors } from '../extraction/extract';
import type { Color } from '../types';
import { isValidColorFormat, parseColorToHSL } from '../utils/colorConversion';
import { promptForFilterOptions } from './filterPrompts';
import type { ColorFilterOptions, ColorFilterResult } from './filterTypes';

// Re-exported so filter.ts stays the public face of the command.
export type * from './filterTypes';

import { formatDuration } from '../utils/format';

/**
 * Register the filter colors command
 */
export function registerFilterCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand(
		'colors-le.filter',
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
						'No colors found to filter',
					);
					return;
				}

				// Prompt user for filter options
				const options = await promptForFilterOptions(result.colors);
				if (!options) {
					return; // User cancelled
				}

				// Apply filters
				const filterResult = filterColors(result.colors, options);
				const durationMs = performance.now() - startTime;

				// Generate filter report
				const report = generateFilterReport(filterResult, durationMs);

				// Create and show filter document
				const doc = await vscode.workspace.openTextDocument({
					content: report,
					language: 'markdown',
				});

				await vscode.window.showTextDocument(doc, {
					viewColumn: vscode.ViewColumn.Beside,
					preview: false,
				});

				await vscode.window.showInformationMessage(
					`Color filtering completed. ${filterResult.summary.kept.toString()} colors kept, ${filterResult.summary.excluded.toString()} excluded.`,
				);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown error';
				await vscode.window.showErrorMessage(
					`Filtering failed: ${errorMessage}`,
				);
			}
		},
	);

	context.subscriptions.push(disposable);
}

/**
 * Filter colors based on options
 */
export function filterColors(
	colors: readonly Color[],
	options: ColorFilterOptions,
): ColorFilterResult {
	const filtered: Color[] = [];
	const excluded: Color[] = [];
	const exclusionReasons: Map<string, number> = new Map();

	const addExclusionReason = (reason: string) => {
		exclusionReasons.set(reason, (exclusionReasons.get(reason) || 0) + 1);
	};

	const seenColors = new Set<string>();

	for (const color of colors) {
		let shouldExclude = false;
		const excludeReasons: string[] = [];

		// Format filtering
		if (options.formats && !options.formats.includes(color.format)) {
			shouldExclude = true;
			excludeReasons.push('format not included');
		}

		if (options.excludeFormats?.includes(color.format)) {
			shouldExclude = true;
			excludeReasons.push('format excluded');
		}

		// Parse color for HSL analysis
		const hsl = parseColorToHSL(color.value);

		// Lightness filtering
		if (
			hsl &&
			(options.minLightness !== undefined || options.maxLightness !== undefined)
		) {
			if (options.minLightness !== undefined && hsl.l < options.minLightness) {
				shouldExclude = true;
				excludeReasons.push('too dark');
			}
			if (options.maxLightness !== undefined && hsl.l > options.maxLightness) {
				shouldExclude = true;
				excludeReasons.push('too light');
			}
		}

		// Saturation filtering
		if (
			hsl &&
			(options.minSaturation !== undefined ||
				options.maxSaturation !== undefined)
		) {
			if (
				options.minSaturation !== undefined &&
				hsl.s < options.minSaturation
			) {
				shouldExclude = true;
				excludeReasons.push('too muted');
			}
			if (
				options.maxSaturation !== undefined &&
				hsl.s > options.maxSaturation
			) {
				shouldExclude = true;
				excludeReasons.push('too vibrant');
			}
		}

		// Hue range filtering
		if (hsl && options.hueRange) {
			const { min, max } = options.hueRange;
			if (hsl.h < min || hsl.h > max) {
				shouldExclude = true;
				excludeReasons.push('hue out of range');
			}
		}

		// Duplicate filtering
		if (options.excludeDuplicates) {
			const colorKey = color.value.toLowerCase();
			if (seenColors.has(colorKey)) {
				shouldExclude = true;
				excludeReasons.push('duplicate');
			}
			if (!seenColors.has(colorKey)) {
				seenColors.add(colorKey);
			}
		}

		// Invalid color filtering
		if (options.excludeInvalid && !isValidColorFormat(color.value)) {
			shouldExclude = true;
			excludeReasons.push('invalid format');
		}

		// Transparent filtering
		if (options.excludeTransparent && isTransparentColor(color.value)) {
			shouldExclude = true;
			excludeReasons.push('transparent');
		}

		// Custom pattern filtering
		if (options.customPattern) {
			try {
				const regex = new RegExp(options.customPattern, 'i');
				if (!regex.test(color.value)) {
					shouldExclude = true;
					excludeReasons.push('pattern mismatch');
				}
			} catch {
				// Invalid regex, ignore pattern filter
			}
		}

		if (shouldExclude) {
			excluded.push(color);
			for (const reason of excludeReasons) {
				addExclusionReason(reason);
			}
		}
		if (!shouldExclude) {
			filtered.push(color);
		}
	}

	return Object.freeze({
		original: colors,
		filtered: Object.freeze(filtered),
		excluded: Object.freeze(excluded),
		options,
		timestamp: Date.now(),
		summary: Object.freeze({
			total: colors.length,
			kept: filtered.length,
			excluded: excluded.length,
			exclusionReasons: Object.freeze(
				Array.from(exclusionReasons.entries()).map(([reason, count]) =>
					Object.freeze({ reason, count }),
				),
			),
		}),
	});
}

/**
 * Generate filter report
 */
function generateFilterReport(
	result: ColorFilterResult,
	durationMs: number,
): string {
	const report: string[] = [];

	// Header
	report.push('# Color Filter Report');
	report.push('');
	report.push(`**Generated**: ${new Date().toISOString()}`);
	report.push(`**Filter Time**: ${formatDuration(durationMs)}`);
	report.push('');

	// Summary
	report.push('## Summary');
	report.push('');
	report.push(`- **Total Colors**: ${result.summary.total}`);
	report.push(`- **Kept**: ${result.summary.kept}`);
	report.push(`- **Excluded**: ${result.summary.excluded}`);
	report.push(
		`- **Retention Rate**: ${((result.summary.kept / result.summary.total) * 100).toFixed(1)}%`,
	);
	report.push('');

	// Filter Options
	report.push('## Filter Options');
	report.push('');
	if (result.options.formats) {
		report.push(
			`- **Include Formats**: ${result.options.formats.map((f) => f.toUpperCase()).join(', ')}`,
		);
	}
	if (result.options.excludeFormats) {
		report.push(
			`- **Exclude Formats**: ${result.options.excludeFormats
				.map((f) => f.toUpperCase())
				.join(', ')}`,
		);
	}
	if (result.options.minLightness !== undefined) {
		report.push(`- **Min Lightness**: ${result.options.minLightness}%`);
	}
	if (result.options.maxLightness !== undefined) {
		report.push(`- **Max Lightness**: ${result.options.maxLightness}%`);
	}
	if (result.options.minSaturation !== undefined) {
		report.push(`- **Min Saturation**: ${result.options.minSaturation}%`);
	}
	if (result.options.maxSaturation !== undefined) {
		report.push(`- **Max Saturation**: ${result.options.maxSaturation}%`);
	}
	if (result.options.excludeDuplicates) {
		report.push('- **Exclude Duplicates**: Yes');
	}
	if (result.options.excludeInvalid) {
		report.push('- **Exclude Invalid**: Yes');
	}
	if (result.options.excludeTransparent) {
		report.push('- **Exclude Transparent**: Yes');
	}
	report.push('');

	// Exclusion Reasons
	if (result.summary.exclusionReasons.length > 0) {
		report.push('## Exclusion Reasons');
		report.push('');
		report.push('| Reason | Count | Percentage |');
		report.push('|--------|-------|------------|');

		for (const { reason, count } of result.summary.exclusionReasons) {
			const percentage = ((count / result.summary.excluded) * 100).toFixed(1);
			report.push(`| ${reason} | ${count} | ${percentage}% |`);
		}
		report.push('');
	}

	// Filtered Colors
	if (result.filtered.length > 0) {
		report.push('## Filtered Colors');
		report.push('');
		report.push('| Color | Format | Context |');
		report.push('|-------|--------|---------|');

		for (const color of result.filtered.slice(0, 50)) {
			// Limit to first 50 for readability
			const context = color.context || 'N/A';
			report.push(
				`| \`${color.value}\` | ${color.format.toUpperCase()} | ${context} |`,
			);
		}

		if (result.filtered.length > 50) {
			report.push(
				`| ... | ... | *${result.filtered.length - 50} more colors* |`,
			);
		}
		report.push('');

		// Colors for copying
		report.push('### Colors (for copying)');
		report.push('');
		report.push('```');
		for (const color of result.filtered) {
			report.push(color.value);
		}
		report.push('```');
		report.push('');
	}

	report.push('---');
	report.push('*Generated by Colors-LE Color Filter*');

	return report.join('\n');
}

// Helper functions

function isTransparentColor(color: string): boolean {
	if (color.toLowerCase() === 'transparent') return true;

	const rgba = color.match(
		/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/,
	);
	if (rgba?.[1] && Number.parseFloat(rgba[1]) === 0) return true;

	const hsla = color.match(
		/hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*([\d.]+)\s*\)/,
	);
	if (hsla?.[1] && Number.parseFloat(hsla[1]) === 0) return true;

	const hex8 = color.match(/^#[0-9a-f]{6}([0-9a-f]{2})$/i);
	if (hex8?.[1] && Number.parseInt(hex8[1], 16) === 0) return true;

	return false;
}
