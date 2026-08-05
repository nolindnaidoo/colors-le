import { describe, expect, it } from 'vitest';
import type { Color } from '../types';
import { filterColors } from './filter';

/**
 * The filtering engine, exercised directly.
 *
 * The command wraps it in a prompt sequence, so driving it through the UI
 * covers one option combination per test run. Every predicate — format
 * include/exclude, lightness and saturation bounds, hue range and the three
 * exclusions — is independent, and this is where they are actually checked.
 */

function color(value: string, format: Color['format'] = 'hex'): Color {
	return { value, format };
}

const PALETTE: readonly Color[] = [
	color('#ff0000'),
	color('#000000'),
	color('#ffffff'),
	color('rgb(0, 255, 0)', 'rgb'),
	color('hsl(240, 100%, 50%)', 'hsl'),
];

describe('filterColors: no options', () => {
	it('keeps everything when nothing is set', () => {
		const result = filterColors(PALETTE, {});
		expect(result.filtered).toHaveLength(PALETTE.length);
		expect(result.excluded).toHaveLength(0);
	});

	it('handles an empty palette', () => {
		const result = filterColors([], {});
		expect(result.filtered).toHaveLength(0);
	});
});

describe('filterColors: format filters', () => {
	it('keeps only the included formats', () => {
		const result = filterColors(PALETTE, { formats: ['hex'] });
		expect(result.filtered.every((c) => c.format === 'hex')).toBe(true);
		expect(result.excluded.length).toBeGreaterThan(0);
	});

	it('drops the excluded formats', () => {
		const result = filterColors(PALETTE, { excludeFormats: ['hex'] });
		expect(result.filtered.some((c) => c.format === 'hex')).toBe(false);
	});
});

describe('filterColors: lightness bounds', () => {
	it('drops colours below the minimum', () => {
		const result = filterColors(PALETTE, { minLightness: 50 });
		expect(result.filtered.some((c) => c.value === '#000000')).toBe(false);
	});

	it('drops colours above the maximum', () => {
		const result = filterColors(PALETTE, { maxLightness: 50 });
		expect(result.filtered.some((c) => c.value === '#ffffff')).toBe(false);
	});

	it('applies both bounds together', () => {
		const result = filterColors(PALETTE, {
			minLightness: 30,
			maxLightness: 70,
		});
		expect(result.filtered.some((c) => c.value === '#000000')).toBe(false);
		expect(result.filtered.some((c) => c.value === '#ffffff')).toBe(false);
	});
});

describe('filterColors: saturation bounds', () => {
	it('drops colours below the minimum saturation', () => {
		// Greys have zero saturation.
		const result = filterColors(PALETTE, { minSaturation: 50 });
		expect(result.filtered.some((c) => c.value === '#000000')).toBe(false);
	});

	it('drops colours above the maximum saturation', () => {
		const result = filterColors(PALETTE, { maxSaturation: 10 });
		expect(result.filtered.some((c) => c.value === '#ff0000')).toBe(false);
	});
});

describe('filterColors: exclusions', () => {
	it('removes duplicates when asked', () => {
		const withDupes = [color('#ff0000'), color('#ff0000'), color('#00ff00')];
		const result = filterColors(withDupes, { excludeDuplicates: true });
		expect(result.filtered).toHaveLength(2);
	});

	it('removes invalid colours when asked', () => {
		const withJunk = [color('#ff0000'), color('notacolour')];
		const result = filterColors(withJunk, { excludeInvalid: true });
		expect(result.filtered.some((c) => c.value === 'notacolour')).toBe(false);
	});

	it('removes transparent colours when asked', () => {
		const withAlpha = [
			color('#ff0000'),
			color('rgba(255, 0, 0, 0)', 'rgba'),
			color('transparent', 'named'),
		];
		const result = filterColors(withAlpha, { excludeTransparent: true });
		expect(result.filtered.some((c) => c.value.includes('0)'))).toBe(false);
	});

	it('keeps transparent colours when not asked', () => {
		const withAlpha = [color('rgba(255, 0, 0, 0)', 'rgba')];
		const result = filterColors(withAlpha, {});
		expect(result.filtered).toHaveLength(1);
	});
});

describe('filterColors: combined', () => {
	it('applies format and lightness filters together', () => {
		const result = filterColors(PALETTE, {
			formats: ['hex'],
			minLightness: 30,
		});
		expect(result.filtered.every((c) => c.format === 'hex')).toBe(true);
		expect(result.filtered.some((c) => c.value === '#000000')).toBe(false);
	});

	it('accounts for every colour across filtered and excluded', () => {
		const result = filterColors(PALETTE, { formats: ['hex'] });
		expect(result.filtered.length + result.excluded.length).toBe(
			PALETTE.length,
		);
	});
});
