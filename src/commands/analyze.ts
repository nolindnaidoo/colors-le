import * as vscode from 'vscode';
import {
	analyzePalette,
	type ColorAnomaly,
	type ColorCluster,
	type ColorGap,
	type ColorPattern,
	type ColorStatistics,
	calculateColorStatistics,
	clusterColors,
	detectColorAnomalies,
	detectColorGaps,
	detectColorPatterns,
	type PaletteAnalysis,
} from '../analysis/colorAnalysis';
import { extractColors } from '../extraction/extract';
import type { Color } from '../types';
import { createLocalizer } from '../utils/localization';
import { formatDuration } from '../utils/performance';

interface AnalyzeDeps {
	readonly performanceMonitor: {
		startTimer: (operation: string) => { id: string; startTime: number };
		endTimer: (timer: { id: string; startTime: number }) => {
			duration: number;
			memoryUsage: number;
		};
	};
}

/**
 * Register the analyze colors command
 */
export function registerAnalyzeCommand(
	context: vscode.ExtensionContext,
	deps: AnalyzeDeps,
): void {
	const disposable = vscode.commands.registerCommand(
		'colors-le.analyze',
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

				const timer = deps.performanceMonitor.startTimer('analyze-colors');

				// Extract colors first
				const result = await extractColors(
					editor.document.getText(),
					editor.document.fileName,
				);

				if (!result.success || result.colors.length === 0) {
					await vscode.window.showInformationMessage(
						localizer.localize(
							'runtime.analyze.no-colors',
							'No colors found to analyze',
						),
					);
					return;
				}

				// Perform comprehensive analysis
				const statistics = calculateColorStatistics(result.colors);
				const anomalies = detectColorAnomalies(result.colors);
				const patterns = detectColorPatterns(result.colors);
				const clusters = clusterColors(result.colors);
				const gaps = detectColorGaps(result.colors);
				const palette = analyzePalette(result.colors);

				const metrics = deps.performanceMonitor.endTimer(timer);

				// Generate analysis report
				const report = generateAnalysisReport(
					result.colors,
					statistics,
					anomalies,
					patterns,
					clusters,
					gaps,
					palette,
					metrics,
				);

				// Create and show analysis document
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
						'runtime.analyze.success',
						'Color analysis completed. Found {0} colors with {1} unique values.',
						statistics.total.toString(),
						statistics.unique.toString(),
					),
				);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown error';
				await vscode.window.showErrorMessage(
					localizer.localize(
						'runtime.analyze.error',
						'Analysis failed: {0}',
						errorMessage,
					),
				);
			}
		},
	);

	context.subscriptions.push(disposable);
}

/**
 * Generate comprehensive analysis report
 */
function generateAnalysisReport(
	_colors: readonly Color[],
	statistics: ColorStatistics,
	anomalies: readonly ColorAnomaly[],
	patterns: readonly ColorPattern[],
	clusters: readonly ColorCluster[],
	gaps: readonly ColorGap[],
	palette: PaletteAnalysis,
	metrics: { duration: number; memoryUsage: number },
): string {
	const report: string[] = [];

	// Header
	report.push('# Color Analysis Report');
	report.push('');
	report.push(`**Generated**: ${new Date().toISOString()}`);
	report.push(`**Analysis Time**: ${formatDuration(metrics.duration)}`);
	report.push(`**Memory Usage**: ${formatMemoryUsage(metrics.memoryUsage)}`);
	report.push('');

	// Overview
	report.push('## Overview');
	report.push('');
	report.push(`- **Total Colors**: ${statistics.total}`);
	report.push(`- **Unique Colors**: ${statistics.unique}`);
	report.push(
		`- **Duplication Rate**: ${((1 - statistics.unique / statistics.total) * 100).toFixed(1)}%`,
	);
	if (statistics.dominantHue !== undefined) {
		report.push(`- **Dominant Hue**: ${Math.round(statistics.dominantHue)}°`);
	}
	if (statistics.averageSaturation !== undefined) {
		report.push(
			`- **Average Saturation**: ${Math.round(statistics.averageSaturation)}%`,
		);
	}
	if (statistics.averageLightness !== undefined) {
		report.push(
			`- **Average Lightness**: ${Math.round(statistics.averageLightness)}%`,
		);
	}
	report.push('');

	// Format Distribution
	if (statistics.byFormat.length > 0) {
		report.push('## Format Distribution');
		report.push('');
		report.push('| Format | Count | Percentage |');
		report.push('|--------|-------|------------|');
		for (const format of statistics.byFormat) {
			report.push(
				`| ${format.format.toUpperCase()} | ${format.count} | ${format.percentage.toFixed(1)}% |`,
			);
		}
		report.push('');
	}

	// Most Common Colors
	if (statistics.mostCommon.length > 0) {
		report.push('## Most Common Colors');
		report.push('');
		report.push('| Color | Count | Percentage |');
		report.push('|-------|-------|------------|');
		for (const color of statistics.mostCommon.slice(0, 10)) {
			report.push(
				`| \`${color.color}\` | ${color.count} | ${color.percentage.toFixed(1)}% |`,
			);
		}
		report.push('');
	}

	// Palette Analysis
	report.push('## Palette Analysis');
	report.push('');
	report.push(
		`- **Color Harmony**: ${palette.harmony.type} (${(
			palette.harmony.confidence * 100
		).toFixed(0)}% confidence)`,
	);
	report.push(`- **Temperature**: ${palette.temperature}`);
	report.push(`- **Mood**: ${palette.mood}`);
	report.push(
		`- **WCAG AA Compliance**: ${palette.accessibility.wcagAA ? '✅ Pass' : '❌ Fail'}`,
	);
	report.push(
		`- **WCAG AAA Compliance**: ${palette.accessibility.wcagAAA ? '✅ Pass' : '❌ Fail'}`,
	);
	report.push('');
	report.push(`**Harmony Description**: ${palette.harmony.description}`);
	report.push('');

	// Color Clusters
	if (clusters.length > 0) {
		report.push('## Color Clusters');
		report.push('');
		for (const cluster of clusters) {
			report.push(`### ${cluster.label || 'Cluster'} (${cluster.size} colors)`);
			report.push('');
			report.push(`**Centroid**: \`${cluster.centroid}\``);
			report.push(`**Variance**: ${cluster.variance.toFixed(2)}`);
			report.push('');
			report.push('**Colors**:');
			for (const color of cluster.colors) {
				report.push(`- \`${color}\``);
			}
			report.push('');
		}
	}

	// Patterns
	if (patterns.length > 0) {
		report.push('## Detected Patterns');
		report.push('');
		for (const pattern of patterns) {
			report.push(
				`### ${pattern.type.charAt(0).toUpperCase() + pattern.type.slice(1)} Pattern`,
			);
			report.push('');
			report.push(`**Confidence**: ${(pattern.confidence * 100).toFixed(0)}%`);
			report.push(`**Description**: ${pattern.description}`);
			report.push('');
			report.push('**Colors**:');
			for (const color of pattern.colors) {
				report.push(`- \`${color}\``);
			}
			report.push('');
		}
	}

	// Anomalies
	if (anomalies.length > 0) {
		report.push('## Anomalies & Issues');
		report.push('');

		const groupedAnomalies = groupAnomaliesByType(anomalies);

		for (const [type, typeAnomalies] of Object.entries(groupedAnomalies)) {
			report.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)} Issues`);
			report.push('');

			for (const anomaly of typeAnomalies) {
				const severityIcon =
					anomaly.severity === 'high'
						? '🔴'
						: anomaly.severity === 'medium'
							? '🟡'
							: '🟢';
				report.push(`${severityIcon} **${anomaly.color}**: ${anomaly.message}`);
				if (anomaly.suggestion) {
					report.push(`   *Suggestion: ${anomaly.suggestion}*`);
				}
				report.push('');
			}
		}
	}

	// Gaps
	if (gaps.length > 0) {
		report.push('## Color Coverage Gaps');
		report.push('');
		for (const gap of gaps) {
			const severityIcon =
				gap.severity === 'high'
					? '🔴'
					: gap.severity === 'medium'
						? '🟡'
						: '🟢';
			report.push(
				`${severityIcon} **${gap.type.charAt(0).toUpperCase() + gap.type.slice(1)} Gap**: ${
					gap.description
				}`,
			);
			report.push('');
			if (gap.missingColors.length > 0) {
				report.push('**Suggested Colors**:');
				for (const color of gap.missingColors) {
					report.push(`- \`${color}\``);
				}
				report.push('');
			}
			if (gap.suggestions.length > 0) {
				report.push('**Recommendations**:');
				for (const suggestion of gap.suggestions) {
					report.push(`- ${suggestion}`);
				}
				report.push('');
			}
		}
	}

	// Usage Analysis
	if (palette.usage.length > 0) {
		report.push('## Color Usage');
		report.push('');
		report.push('| Color | Frequency | Contexts |');
		report.push('|-------|-----------|----------|');
		for (const usage of palette.usage.slice(0, 20)) {
			const contexts = usage.contexts.slice(0, 3).join(', ');
			const moreContexts =
				usage.contexts.length > 3
					? ` (+${usage.contexts.length - 3} more)`
					: '';
			report.push(
				`| \`${usage.color}\` | ${usage.frequency} | ${contexts}${moreContexts} |`,
			);
		}
		report.push('');
	}

	// Recommendations
	report.push('## Recommendations');
	report.push('');

	if (statistics.unique / statistics.total < 0.7) {
		report.push(
			'- **Reduce Duplication**: Consider using CSS variables for frequently used colors',
		);
	}

	if (palette.harmony.confidence < 0.5) {
		report.push(
			'- **Improve Harmony**: Consider using a color harmony tool to create more cohesive palettes',
		);
	}

	if (!palette.accessibility.wcagAA) {
		report.push(
			'- **Accessibility**: Ensure color combinations meet WCAG contrast requirements',
		);
	}

	if (gaps.length > 0) {
		report.push(
			'- **Color Coverage**: Add colors in missing ranges for better visual balance',
		);
	}

	if (anomalies.filter((a) => a.severity === 'high').length > 0) {
		report.push(
			'- **Fix Critical Issues**: Address high-severity color issues immediately',
		);
	}

	report.push('');
	report.push('---');
	report.push('*Generated by Colors-LE Color Analysis*');

	return report.join('\n');
}

/**
 * Group anomalies by type for better organization
 */
function groupAnomaliesByType(
	anomalies: readonly ColorAnomaly[],
): Record<string, ColorAnomaly[]> {
	const grouped: Record<string, ColorAnomaly[]> = {};

	for (const anomaly of anomalies) {
		if (!grouped[anomaly.type]) {
			grouped[anomaly.type] = [];
		}
		grouped[anomaly.type].push(anomaly);
	}

	return grouped;
}

/**
 * Format memory usage in human-readable format
 */
function formatMemoryUsage(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
