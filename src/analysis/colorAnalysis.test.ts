import { describe, expect, it } from 'vitest';
import type { Color } from '../types';
import {
	analyzePalette,
	calculateColorStatistics,
	clusterColors,
	detectColorAnomalies,
	detectColorGaps,
	detectColorPatterns,
} from './colorAnalysis';

function color(value: string, format: Color['format'] = 'hex'): Color {
	return { value, format };
}

const PALETTE: Color[] = [
	color('#ff0000'),
	color('#00ff00'),
	color('#0000ff'),
	color('#ff0000'),
	color('rgb(128, 128, 128)', 'rgb'),
	color('hsl(60, 100%, 50%)', 'hsl'),
];

describe('calculateColorStatistics', () => {
	it('counts totals, uniques, and format distribution', () => {
		const stats = calculateColorStatistics(PALETTE);
		expect(stats.total).toBe(6);
		expect(stats.unique).toBe(5);
		expect(stats.byFormat.find((f) => f.format === 'hex')?.count).toBe(4);
	});

	it('handles empty input', () => {
		const stats = calculateColorStatistics([]);
		expect(stats.total).toBe(0);
		expect(stats.unique).toBe(0);
	});
});

describe('detectColorAnomalies', () => {
	it('returns a list (possibly empty) for a normal palette', () => {
		expect(Array.isArray(detectColorAnomalies(PALETTE))).toBe(true);
	});

	it('handles empty input', () => {
		expect(detectColorAnomalies([])).toEqual([]);
	});

	it('does not call a keyword or a four-digit hex invalid', () => {
		// Both are notations the extractor reports, and both were listed as
		// high-severity "Invalid color format" anomalies.
		const anomalies = detectColorAnomalies([
			color('red', 'named'),
			color('transparent', 'named'),
			color('#f0a8'),
		]);
		expect(anomalies.filter((a) => a.type === 'invalid')).toEqual([]);
	});
});

describe('detectColorPatterns', () => {
	it('returns patterns for a palette', () => {
		expect(Array.isArray(detectColorPatterns(PALETTE))).toBe(true);
	});
});

describe('clusterColors', () => {
	it('groups similar colors together', () => {
		const clusters = clusterColors([
			color('#ff0000'),
			color('#fe0101'),
			color('#0000ff'),
		]);
		expect(clusters.length).toBeGreaterThanOrEqual(1);
	});
});

describe('detectColorGaps', () => {
	it('returns gaps for a sparse palette', () => {
		expect(Array.isArray(detectColorGaps([color('#ff0000')]))).toBe(true);
	});
});

describe('analyzePalette', () => {
	it('produces a full palette analysis', () => {
		const analysis = analyzePalette(PALETTE);
		expect(analysis.colors.length).toBe(5);
		expect(analysis.harmony).toBeDefined();
		expect(['warm', 'cool', 'neutral']).toContain(analysis.temperature);
	});

	it('handles empty palettes', () => {
		const analysis = analyzePalette([]);
		expect(analysis.colors).toEqual([]);
	});
});

describe('the analysis claims only what it computed', () => {
	// The report said "WCAG AA Compliance: Pass" for every palette, with a
	// contrast ratio of 4.5 nothing had measured; any three colours were a
	// "potential gradient sequence" at 70% confidence; a hex starting with
	// `0` counted as blue, so green and white were a "blue and white theme";
	// and hues were averaged on a line, so 350° and 10° had a dominant hue
	// of 180°, the opposite side of the wheel.
	it('does not claim a WCAG verdict it never checked', () => {
		const { accessibility } = analyzePalette([
			color('#ff0000'),
			color('#00ff00'),
		]);
		expect(accessibility.wcagAA).toBeUndefined();
		expect(accessibility.wcagAAA).toBeUndefined();
		expect(accessibility.contrastRatio).toBeUndefined();
	});

	it('does not call three unrelated colours a gradient', () => {
		const patterns = detectColorPatterns([
			color('#ff0000'),
			color('#00ff00'),
			color('#0000ff'),
		]);
		expect(patterns.filter((p) => p.type === 'gradient')).toEqual([]);
	});

	it('finds a gradient in a run of shades of one hue', () => {
		const patterns = detectColorPatterns([
			color('#330000'),
			color('#660000'),
			color('#990000'),
			color('#cc0000'),
		]);
		const gradient = patterns.find((p) => p.type === 'gradient');
		expect(gradient?.colors).toEqual([
			'#330000',
			'#660000',
			'#990000',
			'#cc0000',
		]);
	});

	it('reads blue by hue, not by a leading zero', () => {
		expect(
			detectColorPatterns([color('#0f0'), color('#ffffff')]).filter(
				(p) => p.type === 'theme',
			),
		).toEqual([]);
		expect(
			detectColorPatterns([color('#0066cc'), color('white', 'named')]).some(
				(p) => p.type === 'theme',
			),
		).toBe(true);
	});

	it('averages hues around the wheel', () => {
		const stats = calculateColorStatistics([
			color('hsl(350, 100%, 50%)', 'hsl'),
			color('hsl(10, 100%, 50%)', 'hsl'),
		]);
		const hue = stats.dominantHue ?? Number.NaN;
		expect(Math.min(hue, 360 - hue)).toBeLessThan(1);
	});

	it('reads two reds either side of 0° as one hue', () => {
		const { harmony } = analyzePalette([
			color('hsl(350, 100%, 50%)', 'hsl'),
			color('hsl(10, 100%, 40%)', 'hsl'),
		]);
		expect(harmony.type).toBe('monochromatic');
	});
});
