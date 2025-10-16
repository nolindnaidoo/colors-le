import * as vscode from 'vscode';
import {
	type ColorConversionOptions,
	type ColorConversionResult,
	convertColors,
	getAvailableFormats,
} from '../conversion/colorConverter';
import { extractColors } from '../extraction/extract';
import { createLocalizer } from '../utils/localization';
import { formatDuration } from '../utils/performance';

interface ConvertDeps {
	readonly performanceMonitor: {
		startTimer: (operation: string) => { id: string; startTime: number };
		endTimer: (timer: { id: string; startTime: number }) => {
			duration: number;
			memoryUsage: number;
		};
	};
}

/**
 * Register the convert colors command
 */
export function registerConvertCommand(
	context: vscode.ExtensionContext,
	deps: ConvertDeps,
): void {
	const disposable = vscode.commands.registerCommand(
		'colors-le.convert',
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

				const timer = deps.performanceMonitor.startTimer('convert-colors');

				// Extract colors first
				const result = await extractColors(
					editor.document.getText(),
					editor.document.fileName,
				);

				if (!result.success || result.colors.length === 0) {
					await vscode.window.showInformationMessage(
						localizer.localize(
							'runtime.convert.no-colors',
							'No colors found to convert',
						),
					);
					return;
				}

				// Prompt user for target format
				const targetFormat = await promptForTargetFormat();
				if (!targetFormat) {
					return; // User cancelled
				}

				// Prompt for conversion options
				const options = await promptForConversionOptions(targetFormat);
				if (!options) {
					return; // User cancelled
				}

				// Convert colors
				const conversions = convertColors(result.colors, options);
				const metrics = deps.performanceMonitor.endTimer(timer);

				// Generate conversion report
				const report = generateConversionReport(conversions, options, metrics);

				// Create and show conversion document
				const doc = await vscode.workspace.openTextDocument({
					content: report,
					language: 'markdown',
				});

				await vscode.window.showTextDocument(doc, {
					viewColumn: vscode.ViewColumn.Beside,
					preview: false,
				});

				const successCount = conversions.filter((c) => c.success).length;
				const failureCount = conversions.length - successCount;

				await vscode.window.showInformationMessage(
					localizer.localize(
						'runtime.convert.success',
						'Color conversion completed. {0} successful, {1} failed.',
						successCount.toString(),
						failureCount.toString(),
					),
				);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown error';
				await vscode.window.showErrorMessage(
					localizer.localize(
						'runtime.convert.error',
						'Conversion failed: {0}',
						errorMessage,
					),
				);
			}
		},
	);

	context.subscriptions.push(disposable);
}

/**
 * Prompt user to select target format
 */
async function promptForTargetFormat(): Promise<string | undefined> {
	const formats = getAvailableFormats();
	const formatItems = formats.map((format) => ({
		label: format.toUpperCase(),
		description: getFormatDescription(format),
		value: format,
	}));

	const selected = await vscode.window.showQuickPick(formatItems, {
		placeHolder: 'Select target color format',
		matchOnDescription: true,
	});

	return selected?.value;
}

/**
 * Prompt user for conversion options
 */
async function promptForConversionOptions(
	targetFormat: string,
): Promise<ColorConversionOptions | undefined> {
	const options: {
		targetFormat: ColorConversionOptions['targetFormat'];
		preserveAlpha?: boolean | undefined;
		roundValues?: boolean | undefined;
		uppercase?: boolean | undefined;
		shortHex?: boolean | undefined;
	} = {
		targetFormat: targetFormat as ColorConversionOptions['targetFormat'],
	};

	// Ask about alpha preservation
	if (['hex', 'rgb', 'hsl'].includes(targetFormat)) {
		const preserveAlpha = await vscode.window.showQuickPick(
			[
				{
					label: 'Yes',
					description: 'Keep alpha channel if present',
					value: true,
				},
				{ label: 'No', description: 'Remove alpha channel', value: false },
			],
			{
				placeHolder: 'Preserve alpha channel?',
			},
		);

		if (preserveAlpha === undefined) return undefined;
		options.preserveAlpha = preserveAlpha.value;
	}

	// Ask about value rounding
	const roundValues = await vscode.window.showQuickPick(
		[
			{ label: 'Yes', description: 'Round values to integers', value: true },
			{ label: 'No', description: 'Keep decimal precision', value: false },
		],
		{
			placeHolder: 'Round values?',
		},
	);

	if (roundValues === undefined) return undefined;
	options.roundValues = roundValues.value;

	// Format-specific options
	if (targetFormat === 'hex') {
		const uppercase = await vscode.window.showQuickPick(
			[
				{ label: 'Lowercase', description: '#ff0000', value: false },
				{ label: 'Uppercase', description: '#FF0000', value: true },
			],
			{
				placeHolder: 'Hex case preference?',
			},
		);

		if (uppercase === undefined) return undefined;
		options.uppercase = uppercase.value;

		const shortHex = await vscode.window.showQuickPick(
			[
				{
					label: 'Yes',
					description: 'Use short hex when possible (#f00)',
					value: true,
				},
				{
					label: 'No',
					description: 'Always use full hex (#ff0000)',
					value: false,
				},
			],
			{
				placeHolder: 'Use short hex notation?',
			},
		);

		if (shortHex === undefined) return undefined;
		options.shortHex = shortHex.value;
	}

	return options as ColorConversionOptions;
}

/**
 * Generate conversion report
 */
function generateConversionReport(
	conversions: readonly ColorConversionResult[],
	options: ColorConversionOptions,
	metrics: { duration: number; memoryUsage: number },
): string {
	const report: string[] = [];

	// Header
	report.push('# Color Conversion Report');
	report.push('');
	report.push(`**Generated**: ${new Date().toISOString()}`);
	report.push(`**Target Format**: ${options.targetFormat.toUpperCase()}`);
	report.push(`**Conversion Time**: ${formatDuration(metrics.duration)}`);
	report.push(`**Memory Usage**: ${formatMemoryUsage(metrics.memoryUsage)}`);
	report.push('');

	// Summary
	const successful = conversions.filter((c) => c.success);
	const failed = conversions.filter((c) => !c.success);

	report.push('## Summary');
	report.push('');
	report.push(`- **Total Colors**: ${conversions.length}`);
	report.push(`- **Successful**: ${successful.length}`);
	report.push(`- **Failed**: ${failed.length}`);
	report.push(
		`- **Success Rate**: ${((successful.length / conversions.length) * 100).toFixed(1)}%`,
	);
	report.push('');

	// Conversion Options
	report.push('## Conversion Options');
	report.push('');
	report.push(`- **Target Format**: ${options.targetFormat.toUpperCase()}`);
	if (options.preserveAlpha !== undefined) {
		report.push(
			`- **Preserve Alpha**: ${options.preserveAlpha ? 'Yes' : 'No'}`,
		);
	}
	if (options.roundValues !== undefined) {
		report.push(`- **Round Values**: ${options.roundValues ? 'Yes' : 'No'}`);
	}
	if (options.uppercase !== undefined) {
		report.push(`- **Uppercase**: ${options.uppercase ? 'Yes' : 'No'}`);
	}
	if (options.shortHex !== undefined) {
		report.push(`- **Short Hex**: ${options.shortHex ? 'Yes' : 'No'}`);
	}
	report.push('');

	// Successful Conversions
	if (successful.length > 0) {
		report.push('## Successful Conversions');
		report.push('');
		report.push('| Original | Converted | Format |');
		report.push('|----------|-----------|--------|');

		for (const conversion of successful) {
			report.push(
				`| \`${conversion.original.value}\` | \`${
					conversion.converted
				}\` | ${conversion.original.format.toUpperCase()} → ${conversion.format.toUpperCase()} |`,
			);
		}
		report.push('');
	}

	// Failed Conversions
	if (failed.length > 0) {
		report.push('## Failed Conversions');
		report.push('');
		report.push('| Original | Error | Format |');
		report.push('|----------|-------|--------|');

		for (const conversion of failed) {
			const error = conversion.error || 'Unknown error';
			report.push(
				`| \`${
					conversion.original.value
				}\` | ${error} | ${conversion.original.format.toUpperCase()} |`,
			);
		}
		report.push('');
	}

	// Format Distribution
	const formatCounts = new Map<string, number>();
	for (const conversion of conversions) {
		const format = conversion.original.format;
		formatCounts.set(format, (formatCounts.get(format) || 0) + 1);
	}

	if (formatCounts.size > 0) {
		report.push('## Original Format Distribution');
		report.push('');
		report.push('| Format | Count | Percentage |');
		report.push('|--------|-------|------------|');

		for (const [format, count] of Array.from(formatCounts.entries()).sort(
			(a, b) => b[1] - a[1],
		)) {
			const percentage = ((count / conversions.length) * 100).toFixed(1);
			report.push(`| ${format.toUpperCase()} | ${count} | ${percentage}% |`);
		}
		report.push('');
	}

	// Converted Colors (for easy copying)
	if (successful.length > 0) {
		report.push('## Converted Colors');
		report.push('');
		report.push('```');
		for (const conversion of successful) {
			report.push(conversion.converted);
		}
		report.push('```');
		report.push('');
	}

	report.push('---');
	report.push('*Generated by Colors-LE Color Conversion*');

	return report.join('\n');
}

/**
 * Get description for a color format
 */
function getFormatDescription(format: string): string {
	switch (format) {
		case 'hex':
			return 'Hexadecimal notation (#ff0000)';
		case 'rgb':
			return 'RGB functional notation (rgb(255, 0, 0))';
		case 'rgba':
			return 'RGBA with alpha channel (rgba(255, 0, 0, 1))';
		case 'hsl':
			return 'HSL functional notation (hsl(0, 100%, 50%))';
		case 'hsla':
			return 'HSLA with alpha channel (hsla(0, 100%, 50%, 1))';
		case 'oklch':
			return 'OKLCH color space (oklch(0.6 0.15 29))';
		default:
			return 'Unknown format';
	}
}

/**
 * Format memory usage in human-readable format
 */
function formatMemoryUsage(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
