import type { Color } from '../types';
import { isValidColorFormat, parseColorToHSL } from '../utils/colorConversion';

export interface ColorStatistics {
	readonly total: number;
	readonly unique: number;
	readonly byFormat: readonly {
		readonly format: string;
		readonly count: number;
		readonly percentage: number;
	}[];
	readonly mostCommon: readonly {
		readonly color: string;
		readonly count: number;
		readonly percentage: number;
	}[];
	readonly dominantHue?: number | undefined;
	readonly averageSaturation?: number | undefined;
	readonly averageLightness?: number | undefined;
	readonly contrastRatio?: number | undefined;
}

export interface ColorHarmony {
	readonly type:
		| 'monochromatic'
		| 'analogous'
		| 'complementary'
		| 'triadic'
		| 'tetradic'
		| 'split-complementary'
		| 'none';
	readonly colors: readonly string[];
	readonly confidence: number;
	readonly description: string;
}

/**
 * Contrast needs a background, and a palette has none: the verdicts and the
 * ratio are undefined here, never a value nothing measured. The report said
 * "WCAG AA Compliance: Pass" at 4.5:1 for every palette.
 */
export interface ColorAccessibility {
	readonly wcagAA: boolean | undefined;
	readonly wcagAAA: boolean | undefined;
	readonly contrastRatio: number | undefined;
	readonly recommendations: readonly string[];
	readonly issues: readonly {
		readonly type: 'contrast' | 'color-blindness' | 'readability';
		readonly severity: 'low' | 'medium' | 'high';
		readonly message: string;
		readonly suggestion?: string | undefined;
	}[];
}

export interface PaletteAnalysis {
	readonly colors: readonly string[];
	readonly harmony: ColorHarmony;
	readonly accessibility: ColorAccessibility;
	readonly temperature: 'warm' | 'cool' | 'neutral';
	readonly mood: 'vibrant' | 'muted' | 'pastel' | 'dark' | 'light';
	readonly usage: readonly {
		readonly color: string;
		readonly frequency: number;
		readonly contexts: readonly string[];
	}[];
}

export interface ColorAnomaly {
	readonly type:
		| 'outlier'
		| 'duplicate'
		| 'invalid'
		| 'accessibility'
		| 'harmony';
	readonly color: string;
	readonly severity: 'low' | 'medium' | 'high';
	readonly message: string;
	readonly suggestion?: string | undefined;
	readonly context?: string | undefined;
}

export interface ColorPattern {
	readonly type: 'gradient' | 'theme' | 'brand' | 'semantic' | 'systematic';
	readonly colors: readonly string[];
	readonly confidence: number;
	readonly description: string;
	readonly examples: readonly string[];
}

export interface ColorCluster {
	readonly centroid: string;
	readonly colors: readonly string[];
	readonly size: number;
	readonly variance: number;
	readonly label?: string | undefined;
}

export interface ColorGap {
	readonly type: 'hue' | 'saturation' | 'lightness' | 'semantic';
	readonly description: string;
	readonly missingColors: readonly string[];
	readonly severity: 'low' | 'medium' | 'high';
	readonly suggestions: readonly string[];
}

/**
 * Calculate comprehensive color statistics
 */
export function calculateColorStatistics(
	colors: readonly Color[],
): ColorStatistics {
	if (colors.length === 0) {
		return Object.freeze({
			total: 0,
			unique: 0,
			byFormat: [],
			mostCommon: [],
			dominantHue: undefined,
			averageSaturation: undefined,
			averageLightness: undefined,
			contrastRatio: undefined,
		});
	}

	const colorValues = colors.map((c) => c.value.toLowerCase());
	const uniqueColors = [...new Set(colorValues)];

	// Count by format
	const formatCounts = new Map<string, number>();
	for (const color of colors) {
		const count = formatCounts.get(color.format) || 0;
		formatCounts.set(color.format, count + 1);
	}

	const byFormat = Array.from(formatCounts.entries())
		.map(([format, count]) =>
			Object.freeze({
				format,
				count,
				percentage: (count / colors.length) * 100,
			}),
		)
		.sort((a, b) => b.count - a.count);

	// Count occurrences
	const colorCounts = new Map<string, number>();
	for (const color of colorValues) {
		const count = colorCounts.get(color) || 0;
		colorCounts.set(color, count + 1);
	}

	const mostCommon = Array.from(colorCounts.entries())
		.map(([color, count]) =>
			Object.freeze({
				color,
				count,
				percentage: (count / colors.length) * 100,
			}),
		)
		.sort((a, b) => b.count - a.count)
		.slice(0, 10);

	// Calculate HSL averages for valid colors
	const hslValues = colors
		.map((c) => parseColorToHSL(c.value))
		.filter((hsl): hsl is { h: number; s: number; l: number } => hsl !== null);

	// Around the wheel, not along a line: 350° and 10° are both red, and
	// their mean is 0°, not 180°.
	const dominantHue =
		hslValues.length > 0
			? circularMeanHue(hslValues.map((hsl) => hsl.h))
			: undefined;

	const averageSaturation =
		hslValues.length > 0
			? hslValues.reduce((sum, hsl) => sum + hsl.s, 0) / hslValues.length
			: undefined;

	const averageLightness =
		hslValues.length > 0
			? hslValues.reduce((sum, hsl) => sum + hsl.l, 0) / hslValues.length
			: undefined;

	return Object.freeze({
		total: colors.length,
		unique: uniqueColors.length,
		byFormat: Object.freeze(byFormat),
		mostCommon: Object.freeze(mostCommon),
		dominantHue,
		averageSaturation,
		averageLightness,
		contrastRatio: undefined, // Would need background color context
	});
}

/**
 * Detect color anomalies in the palette
 */
export function detectColorAnomalies(
	colors: readonly Color[],
): readonly ColorAnomaly[] {
	const anomalies: ColorAnomaly[] = [];
	const colorValues = colors.map((c) => c.value.toLowerCase());
	const uniqueColors = [...new Set(colorValues)];

	// Detect duplicates
	const colorCounts = new Map<string, number>();
	for (const color of colorValues) {
		const count = colorCounts.get(color) || 0;
		colorCounts.set(color, count + 1);
	}

	for (const [color, count] of colorCounts.entries()) {
		if (count > 5) {
			anomalies.push(
				Object.freeze({
					type: 'duplicate',
					color,
					severity: count > 10 ? 'high' : 'medium',
					message: `Color "${color}" appears ${count} times`,
					suggestion: 'Consider using CSS variables for repeated colors',
				}),
			);
		}
	}

	// Detect invalid colors
	for (const color of uniqueColors) {
		if (!isValidColorFormat(color)) {
			anomalies.push(
				Object.freeze({
					type: 'invalid',
					color,
					severity: 'high',
					message: `Invalid color format: "${color}"`,
					suggestion: 'Use valid hex, rgb, hsl, or named color formats',
				}),
			);
		}
	}

	// Detect accessibility issues (simplified)
	for (const color of uniqueColors) {
		const hsl = parseColorToHSL(color);
		if (hsl && hsl.l < 10) {
			anomalies.push(
				Object.freeze({
					type: 'accessibility',
					color,
					severity: 'medium',
					message: `Very dark color may have contrast issues: "${color}"`,
					suggestion: 'Ensure sufficient contrast with background colors',
				}),
			);
		}
		if (hsl && hsl.l > 90) {
			anomalies.push(
				Object.freeze({
					type: 'accessibility',
					color,
					severity: 'medium',
					message: `Very light color may have contrast issues: "${color}"`,
					suggestion: 'Ensure sufficient contrast with background colors',
				}),
			);
		}
	}

	return Object.freeze(anomalies);
}

/**
 * Detect color patterns in the palette
 */
export function detectColorPatterns(
	colors: readonly Color[],
): readonly ColorPattern[] {
	const patterns: ColorPattern[] = [];
	const uniqueColors = [...new Set(colors.map((c) => c.value.toLowerCase()))];

	if (uniqueColors.length < 2) {
		return Object.freeze(patterns);
	}

	// Detect gradient patterns
	const gradientPattern = detectGradientPattern(uniqueColors);
	if (gradientPattern) {
		patterns.push(gradientPattern);
	}

	// Detect theme patterns
	const themePattern = detectThemePattern(uniqueColors);
	if (themePattern) {
		patterns.push(themePattern);
	}

	// Detect brand patterns
	const brandPattern = detectBrandPattern(uniqueColors);
	if (brandPattern) {
		patterns.push(brandPattern);
	}

	return Object.freeze(patterns);
}

/**
 * Cluster colors by similarity
 */
export function clusterColors(
	colors: readonly Color[],
	maxClusters = 5,
): readonly ColorCluster[] {
	const uniqueColors = [...new Set(colors.map((c) => c.value.toLowerCase()))];

	if (uniqueColors.length <= maxClusters) {
		return uniqueColors.map((color) =>
			Object.freeze({
				centroid: color,
				colors: [color],
				size: 1,
				variance: 0,
				label: undefined,
			}),
		);
	}

	// Simple clustering by hue
	const hslColors = uniqueColors
		.map((color) => ({ color, hsl: parseColorToHSL(color) }))
		.filter(
			(
				item,
			): item is { color: string; hsl: { h: number; s: number; l: number } } =>
				item.hsl !== null,
		);

	if (hslColors.length === 0) {
		return Object.freeze([]);
	}

	// Group by hue ranges
	const hueRanges = [
		{ min: 0, max: 30, label: 'Red' },
		{ min: 30, max: 60, label: 'Orange' },
		{ min: 60, max: 120, label: 'Yellow' },
		{ min: 120, max: 180, label: 'Green' },
		{ min: 180, max: 240, label: 'Cyan' },
		{ min: 240, max: 300, label: 'Blue' },
		{ min: 300, max: 360, label: 'Magenta' },
	];

	const clusters: ColorCluster[] = [];

	for (const range of hueRanges) {
		const colorsInRange = hslColors.filter(
			(item) => item.hsl.h >= range.min && item.hsl.h < range.max,
		);

		if (colorsInRange.length > 0) {
			const colors = colorsInRange.map((item) => item.color);
			const centroid = colors[0]; // Simplified - use first color as centroid

			// Guard: centroid must exist since colorsInRange.length > 0
			if (!centroid) continue;

			clusters.push(
				Object.freeze({
					centroid,
					colors: Object.freeze(colors),
					size: colors.length,
					variance: calculateHueVariance(
						colorsInRange.map((item) => item.hsl.h),
					),
					label: range.label,
				}),
			);
		}
	}

	return Object.freeze(clusters.slice(0, maxClusters));
}

/**
 * Detect gaps in color coverage
 */
export function detectColorGaps(colors: readonly Color[]): readonly ColorGap[] {
	const gaps: ColorGap[] = [];
	const uniqueColors = [...new Set(colors.map((c) => c.value.toLowerCase()))];

	const hslColors = uniqueColors
		.map((color) => parseColorToHSL(color))
		.filter((hsl): hsl is { h: number; s: number; l: number } => hsl !== null);

	if (hslColors.length === 0) {
		return Object.freeze(gaps);
	}

	// Check for hue gaps
	const hues = hslColors.map((hsl) => hsl.h).sort((a, b) => a - b);
	const hueGaps: number[] = [];

	for (let i = 1; i < hues.length; i++) {
		const currentHue = hues[i];
		const previousHue = hues[i - 1];

		// Guard: ensure both hues exist
		if (currentHue === undefined || previousHue === undefined) continue;

		const gap = currentHue - previousHue;
		if (gap > 60) {
			// Significant hue gap
			hueGaps.push((previousHue + currentHue) / 2);
		}
	}

	if (hueGaps.length > 0) {
		gaps.push(
			Object.freeze({
				type: 'hue',
				description: `Missing colors in hue ranges: ${hueGaps
					.map((h) => Math.round(h))
					.join(', ')}°`,
				missingColors: hueGaps.map((h) => `hsl(${Math.round(h)}, 50%, 50%)`),
				severity: hueGaps.length > 2 ? 'high' : 'medium',
				suggestions: [
					'Consider adding colors in the missing hue ranges for better color balance',
				],
			}),
		);
	}

	// Check for lightness gaps
	const lightnesses = hslColors.map((hsl) => hsl.l).sort((a, b) => a - b);
	const hasVeryDark = lightnesses.some((l) => l < 20);
	const hasVeryLight = lightnesses.some((l) => l > 80);

	if (!hasVeryDark && !hasVeryLight) {
		gaps.push(
			Object.freeze({
				type: 'lightness',
				description: 'Missing very dark and very light colors',
				missingColors: ['#000000', '#ffffff'],
				severity: 'medium',
				suggestions: [
					'Add darker and lighter variants for better contrast options',
				],
			}),
		);
	}

	return Object.freeze(gaps);
}

/**
 * Analyze color palette comprehensively
 */
export function analyzePalette(colors: readonly Color[]): PaletteAnalysis {
	const uniqueColors = [...new Set(colors.map((c) => c.value.toLowerCase()))];

	// Determine harmony
	const harmony = detectColorHarmony(uniqueColors);

	// Contrast is measured against a background, and a palette has none.
	const accessibility: ColorAccessibility = Object.freeze({
		wcagAA: undefined,
		wcagAAA: undefined,
		contrastRatio: undefined,
		recommendations: [
			'Validate Colors checks contrast against a background you name',
		],
		issues: [],
	});

	// Determine temperature
	const temperature = determineTemperature(uniqueColors);

	// Determine mood
	const mood = determineMood(uniqueColors);

	// Analyze usage
	const colorCounts = new Map<string, number>();
	for (const color of colors) {
		const value = color.value.toLowerCase();
		const count = colorCounts.get(value) || 0;
		colorCounts.set(value, count + 1);
	}

	const usage = Array.from(colorCounts.entries()).map(([color, frequency]) =>
		Object.freeze({
			color,
			frequency,
			contexts: colors
				.filter((c) => c.value.toLowerCase() === color)
				.map((c) => c.context || 'unknown')
				.filter((context, index, arr) => arr.indexOf(context) === index),
		}),
	);

	return Object.freeze({
		colors: Object.freeze(uniqueColors),
		harmony,
		accessibility,
		temperature,
		mood,
		usage: Object.freeze(usage),
	});
}

// Helper functions

/** The shorter way round the wheel between two hues, in degrees. */
function hueDistance(a: number, b: number): number {
	const direct = Math.abs(a - b) % 360;
	return Math.min(direct, 360 - direct);
}

/** The mean direction of a set of hues, in [0, 360). */
function circularMeanHue(hues: readonly number[]): number {
	let x = 0;
	let y = 0;
	for (const hue of hues) {
		x += Math.cos((hue * Math.PI) / 180);
		y += Math.sin((hue * Math.PI) / 180);
	}
	const degrees = (Math.atan2(y, x) * 180) / Math.PI;
	return (Math.round(degrees) + 360) % 360;
}

/** The smallest arc of the wheel that holds every hue, in degrees. */
function hueSpan(hues: readonly number[]): number {
	if (hues.length < 2) return 0;
	const sorted = [...hues]
		.map((h) => ((h % 360) + 360) % 360)
		.sort((a, b) => a - b);
	let largestGap = 0;
	for (let i = 1; i < sorted.length; i++) {
		largestGap = Math.max(largestGap, (sorted[i] ?? 0) - (sorted[i - 1] ?? 0));
	}
	const wrapGap = 360 - (sorted[sorted.length - 1] ?? 0) + (sorted[0] ?? 0);
	return 360 - Math.max(largestGap, wrapGap);
}

/**
 * A gradient is a run of three or more consecutive colours of one hue whose
 * lightness steps one way in small steps. Any three colours used to be a
 * "potential gradient sequence" at 70% confidence.
 */
function detectGradientPattern(colors: readonly string[]): ColorPattern | null {
	const parsed = colors.map((color) => ({
		color,
		hsl: parseColorToHSL(color),
	}));
	let best: string[] = [];
	let run: string[] = [];
	let direction = 0;
	for (let i = 0; i < parsed.length; i++) {
		const here = parsed[i];
		const before = parsed[i - 1];
		const step =
			here?.hsl && before?.hsl ? Math.sign(here.hsl.l - before.hsl.l) : 0;
		const continues =
			here?.hsl !== null &&
			here?.hsl !== undefined &&
			before?.hsl !== null &&
			before?.hsl !== undefined &&
			hueDistance(here.hsl.h, before.hsl.h) <= 15 &&
			step !== 0 &&
			(direction === 0 || step === direction) &&
			Math.abs(here.hsl.l - before.hsl.l) <= 40;
		if (continues && here) {
			run.push(here.color);
			direction = step;
		} else {
			run = here?.hsl ? [here.color] : [];
			direction = 0;
		}
		if (run.length > best.length) best = [...run];
	}
	if (best.length < 3) return null;
	return Object.freeze({
		type: 'gradient',
		colors: Object.freeze(best),
		confidence: Math.min(0.9, 0.5 + 0.1 * (best.length - 3)),
		description: `${best.length} consecutive shades of one hue, lightness stepping one way`,
		examples: Object.freeze(best.slice(0, 3)),
	});
}

/**
 * Blue is a hue, read from the colour: a hex starting with `0` used to
 * count, so green and white were a "blue and white theme".
 */
function detectThemePattern(colors: readonly string[]): ColorPattern | null {
	const isBlue = (hsl: { h: number; s: number; l: number }) =>
		hsl.h >= 200 && hsl.h <= 260 && hsl.s >= 30 && hsl.l > 10 && hsl.l < 90;
	const isWhite = (hsl: { h: number; s: number; l: number }) => hsl.l >= 95;
	const parsed = colors.map((color) => ({
		color,
		hsl: parseColorToHSL(color),
	}));
	const blues = parsed.filter((c) => c.hsl && isBlue(c.hsl));
	const whites = parsed.filter((c) => c.hsl && isWhite(c.hsl));

	if (blues.length > 0 && whites.length > 0) {
		return Object.freeze({
			type: 'theme',
			colors: Object.freeze([...blues, ...whites].map((c) => c.color)),
			confidence: 0.6,
			description: 'Blue and white theme pattern detected',
			examples: Object.freeze([blues[0]?.color ?? '', whites[0]?.color ?? '']),
		});
	}

	return null;
}

function detectBrandPattern(_colors: readonly string[]): ColorPattern | null {
	// Simplified brand detection - would need brand color database
	return null;
}

function calculateHueVariance(hues: readonly number[]): number {
	if (hues.length <= 1) return 0;

	const mean = hues.reduce((sum, h) => sum + h, 0) / hues.length;
	const variance =
		hues.reduce((sum, h) => sum + (h - mean) ** 2, 0) / hues.length;

	return variance;
}

function detectColorHarmony(colors: readonly string[]): ColorHarmony {
	if (colors.length < 2) {
		return Object.freeze({
			type: 'none',
			colors: Object.freeze(colors),
			confidence: 0,
			description: 'Insufficient colors for harmony analysis',
		});
	}

	// Simplified harmony detection
	const hslColors = colors
		.map((color) => parseColorToHSL(color))
		.filter((hsl): hsl is { h: number; s: number; l: number } => hsl !== null);

	if (hslColors.length < 2) {
		return Object.freeze({
			type: 'none',
			colors: Object.freeze(colors),
			confidence: 0,
			description: 'Unable to analyze color harmony',
		});
	}

	// Check for monochromatic (same hue, different saturation/lightness).
	// Measured around the wheel: 350° and 10° are 20° apart, not 340°.
	const hues = hslColors.map((hsl) => hsl.h);
	const hueRange = hueSpan(hues);

	if (hueRange < 30) {
		return Object.freeze({
			type: 'monochromatic',
			colors: Object.freeze(colors),
			confidence: 0.8,
			description:
				'Monochromatic color scheme with variations in saturation and lightness',
		});
	}

	// Check for complementary (opposite hues)
	if (
		hslColors.length === 2 &&
		hues[0] !== undefined &&
		hues[1] !== undefined
	) {
		const hueDiff = hueDistance(hues[0], hues[1]);
		if (Math.abs(hueDiff - 180) < 30) {
			return Object.freeze({
				type: 'complementary',
				colors: Object.freeze(colors),
				confidence: 0.9,
				description: 'Complementary color scheme with opposite hues',
			});
		}
	}

	return Object.freeze({
		type: 'none',
		colors: Object.freeze(colors),
		confidence: 0.3,
		description: 'No clear color harmony pattern detected',
	});
}

function determineTemperature(
	colors: readonly string[],
): 'warm' | 'cool' | 'neutral' {
	const hslColors = colors
		.map((color) => parseColorToHSL(color))
		.filter((hsl): hsl is { h: number; s: number; l: number } => hsl !== null);

	if (hslColors.length === 0) return 'neutral';

	const warmCount = hslColors.filter(
		(hsl) => (hsl.h >= 0 && hsl.h < 60) || (hsl.h >= 300 && hsl.h <= 360),
	).length;

	const coolCount = hslColors.filter(
		(hsl) => hsl.h >= 180 && hsl.h < 300,
	).length;

	if (warmCount > coolCount * 1.5) return 'warm';
	if (coolCount > warmCount * 1.5) return 'cool';
	return 'neutral';
}

function determineMood(
	colors: readonly string[],
): 'vibrant' | 'muted' | 'pastel' | 'dark' | 'light' {
	const hslColors = colors
		.map((color) => parseColorToHSL(color))
		.filter((hsl): hsl is { h: number; s: number; l: number } => hsl !== null);

	if (hslColors.length === 0) return 'muted';

	const avgSaturation =
		hslColors.reduce((sum, hsl) => sum + hsl.s, 0) / hslColors.length;
	const avgLightness =
		hslColors.reduce((sum, hsl) => sum + hsl.l, 0) / hslColors.length;

	if (avgLightness < 30) return 'dark';
	if (avgLightness > 80) return 'light';
	if (avgSaturation > 70 && avgLightness > 50) return 'vibrant';
	if (avgSaturation > 40 && avgLightness > 70) return 'pastel';
	return 'muted';
}
