import * as vscode from 'vscode';
import { extractColors } from '../extraction/extract';
import type { Color } from '../types';
import { createLocalizer } from '../utils/localization';
import { formatDuration } from '../utils/performance';

export interface ColorFilterOptions {
	readonly formats?: readonly string[] | undefined;
	readonly excludeFormats?: readonly string[] | undefined;
	readonly minLightness?: number | undefined;
	readonly maxLightness?: number | undefined;
	readonly minSaturation?: number | undefined;
	readonly maxSaturation?: number | undefined;
	readonly hueRange?: { min: number; max: number } | undefined;
	readonly excludeDuplicates?: boolean | undefined;
	readonly excludeInvalid?: boolean | undefined;
	readonly excludeTransparent?: boolean | undefined;
	readonly customPattern?: string | undefined;
}

export interface ColorFilterResult {
	readonly original: readonly Color[];
	readonly filtered: readonly Color[];
	readonly excluded: readonly Color[];
	readonly options: ColorFilterOptions;
	readonly timestamp: number;
	readonly summary: {
		readonly total: number;
		readonly kept: number;
		readonly excluded: number;
		readonly exclusionReasons: readonly { reason: string; count: number }[];
	};
}

interface FilterDeps {
	readonly performanceMonitor: {
		startTimer: (operation: string) => { id: string; startTime: number };
		endTimer: (timer: { id: string; startTime: number }) => {
			duration: number;
			memoryUsage: number;
		};
	};
}

/**
 * Register the filter colors command
 */
export function registerFilterCommand(
	context: vscode.ExtensionContext,
	deps: FilterDeps,
): void {
	const disposable = vscode.commands.registerCommand(
		'colors-le.filter',
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

				const timer = deps.performanceMonitor.startTimer('filter-colors');

				// Extract colors first
				const result = await extractColors(
					editor.document.getText(),
					editor.document.fileName,
				);

				if (!result.success || result.colors.length === 0) {
					await vscode.window.showInformationMessage(
						localizer.localize(
							'runtime.filter.no-colors',
							'No colors found to filter',
						),
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
				const metrics = deps.performanceMonitor.endTimer(timer);

				// Generate filter report
				const report = generateFilterReport(filterResult, metrics);

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
					localizer.localize(
						'runtime.filter.success',
						'Color filtering completed. {0} colors kept, {1} excluded.',
						filterResult.summary.kept.toString(),
						filterResult.summary.excluded.toString(),
					),
				);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown error';
				await vscode.window.showErrorMessage(
					localizer.localize(
						'runtime.filter.error',
						'Filtering failed: {0}',
						errorMessage,
					),
				);
			}
		},
	);

	context.subscriptions.push(disposable);
}

/**
 * Prompt user for filter options
 */
async function promptForFilterOptions(
	colors: readonly Color[],
): Promise<ColorFilterOptions | undefined> {
	const options: {
		formats?: readonly string[] | undefined;
		excludeFormats?: readonly string[] | undefined;
		minLightness?: number | undefined;
		maxLightness?: number | undefined;
		minSaturation?: number | undefined;
		maxSaturation?: number | undefined;
		hueRange?: { min: number; max: number } | undefined;
		excludeDuplicates?: boolean | undefined;
		excludeInvalid?: boolean | undefined;
		excludeTransparent?: boolean | undefined;
		customPattern?: string | undefined;
	} = {};

	// Get available formats from the colors
	const availableFormats = [...new Set(colors.map((c) => c.format))].sort();

	// Format filtering
	const formatAction = await vscode.window.showQuickPick(
		[
			{
				label: 'Include specific formats',
				description: 'Only keep selected formats',
				value: 'include',
			},
			{
				label: 'Exclude specific formats',
				description: 'Remove selected formats',
				value: 'exclude',
			},
			{
				label: 'Keep all formats',
				description: 'No format filtering',
				value: 'none',
			},
		],
		{
			placeHolder: 'How do you want to filter by format?',
		},
	);

	if (formatAction === undefined) return undefined;

	if (formatAction.value === 'include') {
		const selectedFormats = await vscode.window.showQuickPick(
			availableFormats.map((format) => ({
				label: format.toUpperCase(),
				description: `${colors.filter((c) => c.format === format).length} colors`,
				picked: true,
			})),
			{
				placeHolder: 'Select formats to include',
				canPickMany: true,
			},
		);

		if (selectedFormats === undefined) return undefined;
		options.formats = selectedFormats.map((f) => f.label.toLowerCase());
	} else if (formatAction.value === 'exclude') {
		const selectedFormats = await vscode.window.showQuickPick(
			availableFormats.map((format) => ({
				label: format.toUpperCase(),
				description: `${colors.filter((c) => c.format === format).length} colors`,
				picked: false,
			})),
			{
				placeHolder: 'Select formats to exclude',
				canPickMany: true,
			},
		);

		if (selectedFormats === undefined) return undefined;
		options.excludeFormats = selectedFormats.map((f) => f.label.toLowerCase());
	}

	// Lightness filtering
	const lightnessFilter = await vscode.window.showQuickPick(
		[
			{
				label: 'No lightness filter',
				description: 'Keep all lightness values',
				value: 'none',
			},
			{
				label: 'Dark colors only',
				description: 'Lightness < 30%',
				value: 'dark',
			},
			{
				label: 'Light colors only',
				description: 'Lightness > 70%',
				value: 'light',
			},
			{
				label: 'Medium colors only',
				description: '30% ≤ Lightness ≤ 70%',
				value: 'medium',
			},
			{
				label: 'Custom range',
				description: 'Specify min/max lightness',
				value: 'custom',
			},
		],
		{
			placeHolder: 'Filter by lightness?',
		},
	);

	if (lightnessFilter === undefined) return undefined;

	switch (lightnessFilter.value) {
		case 'dark': {
			options.maxLightness = 30;
			break;
		}
		case 'light': {
			options.minLightness = 70;
			break;
		}
		case 'medium': {
			options.minLightness = 30;
			options.maxLightness = 70;
			break;
		}
		case 'custom': {
			const minLightness = await vscode.window.showInputBox({
				prompt: 'Minimum lightness (0-100)',
				value: '0',
				validateInput: (value) => {
					const num = Number.parseInt(value, 10);
					return Number.isNaN(num) || num < 0 || num > 100
						? 'Enter a number between 0 and 100'
						: undefined;
				},
			});
			if (minLightness === undefined) return undefined;

			const maxLightness = await vscode.window.showInputBox({
				prompt: 'Maximum lightness (0-100)',
				value: '100',
				validateInput: (value) => {
					const num = Number.parseInt(value, 10);
					return Number.isNaN(num) || num < 0 || num > 100
						? 'Enter a number between 0 and 100'
						: undefined;
				},
			});
			if (maxLightness === undefined) return undefined;

			options.minLightness = Number.parseInt(minLightness, 10);
			options.maxLightness = Number.parseInt(maxLightness, 10);
			break;
		}
	}

	// Saturation filtering
	const saturationFilter = await vscode.window.showQuickPick(
		[
			{
				label: 'No saturation filter',
				description: 'Keep all saturation values',
				value: 'none',
			},
			{
				label: 'Vibrant colors only',
				description: 'Saturation > 70%',
				value: 'vibrant',
			},
			{
				label: 'Muted colors only',
				description: 'Saturation < 30%',
				value: 'muted',
			},
			{
				label: 'Custom range',
				description: 'Specify min/max saturation',
				value: 'custom',
			},
		],
		{
			placeHolder: 'Filter by saturation?',
		},
	);

	if (saturationFilter === undefined) return undefined;

	switch (saturationFilter.value) {
		case 'vibrant': {
			options.minSaturation = 70;
			break;
		}
		case 'muted': {
			options.maxSaturation = 30;
			break;
		}
		case 'custom': {
			const minSaturation = await vscode.window.showInputBox({
				prompt: 'Minimum saturation (0-100)',
				value: '0',
				validateInput: (value) => {
					const num = Number.parseInt(value, 10);
					return Number.isNaN(num) || num < 0 || num > 100
						? 'Enter a number between 0 and 100'
						: undefined;
				},
			});
			if (minSaturation === undefined) return undefined;

			const maxSaturation = await vscode.window.showInputBox({
				prompt: 'Maximum saturation (0-100)',
				value: '100',
				validateInput: (value) => {
					const num = Number.parseInt(value, 10);
					return Number.isNaN(num) || num < 0 || num > 100
						? 'Enter a number between 0 and 100'
						: undefined;
				},
			});
			if (maxSaturation === undefined) return undefined;

			options.minSaturation = Number.parseInt(minSaturation, 10);
			options.maxSaturation = Number.parseInt(maxSaturation, 10);
			break;
		}
	}

	// Additional filters
	const additionalFilters = await vscode.window.showQuickPick(
		[
			{
				label: 'Exclude duplicates',
				description: 'Remove duplicate color values',
				picked: false,
			},
			{
				label: 'Exclude invalid colors',
				description: 'Remove malformed colors',
				picked: false,
			},
			{
				label: 'Exclude transparent',
				description: 'Remove transparent/alpha colors',
				picked: false,
			},
		],
		{
			placeHolder: 'Additional filters (optional)',
			canPickMany: true,
		},
	);

	if (additionalFilters === undefined) return undefined;

	options.excludeDuplicates = additionalFilters.some(
		(f) => f.label === 'Exclude duplicates',
	);
	options.excludeInvalid = additionalFilters.some(
		(f) => f.label === 'Exclude invalid colors',
	);
	options.excludeTransparent = additionalFilters.some(
		(f) => f.label === 'Exclude transparent',
	);

	return options as ColorFilterOptions;
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
			} else {
				seenColors.add(colorKey);
			}
		}

		// Invalid color filtering
		if (options.excludeInvalid && !isValidColor(color.value)) {
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
		} else {
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
	metrics: { duration: number; memoryUsage: number },
): string {
	const report: string[] = [];

	// Header
	report.push('# Color Filter Report');
	report.push('');
	report.push(`**Generated**: ${new Date().toISOString()}`);
	report.push(`**Filter Time**: ${formatDuration(metrics.duration)}`);
	report.push(`**Memory Usage**: ${formatMemoryUsage(metrics.memoryUsage)}`);
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

function parseColorToHSL(
	color: string,
): { h: number; s: number; l: number } | null {
	// Simplified HSL parsing - reuse logic from colorAnalysis.ts
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

function isValidColor(color: string): boolean {
	const patterns = [
		/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
		/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i,
		/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/i,
		/^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/i,
		/^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)$/i,
	];

	return patterns.some((pattern) => pattern.test(color));
}

function isTransparentColor(color: string): boolean {
	if (color.toLowerCase() === 'transparent') return true;

	const rgba = color.match(
		/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/,
	);
	if (rgba && Number.parseFloat(rgba[1]) === 0) return true;

	const hsla = color.match(
		/hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*([\d.]+)\s*\)/,
	);
	if (hsla && Number.parseFloat(hsla[1]) === 0) return true;

	const hex8 = color.match(/^#[0-9a-f]{6}([0-9a-f]{2})$/i);
	if (hex8 && Number.parseInt(hex8[1], 16) === 0) return true;

	return false;
}

function formatMemoryUsage(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
