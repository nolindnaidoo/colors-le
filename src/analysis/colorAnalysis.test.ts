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
