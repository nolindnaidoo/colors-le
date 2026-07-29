import { describe, expect, it } from 'vitest';
import { sortColors } from './sort';

const COLORS = ['#0000ff', '#ff0000', '#00ff00'];

describe('sortColors', () => {
	it('returns input unchanged when mode is off', () => {
		expect(sortColors(COLORS, 'off')).toEqual(COLORS);
	});

	it('sorts by hue ascending (red < green < blue)', () => {
		expect(sortColors(COLORS, 'hue-asc')).toEqual([
			'#ff0000',
			'#00ff00',
			'#0000ff',
		]);
	});

	it('sorts by hue descending', () => {
		expect(sortColors(COLORS, 'hue-desc')).toEqual([
			'#0000ff',
			'#00ff00',
			'#ff0000',
		]);
	});

	it('sorts by hex ascending / descending', () => {
		expect(sortColors(COLORS, 'hex-asc')).toEqual([
			'#0000ff',
			'#00ff00',
			'#ff0000',
		]);
		expect(sortColors(COLORS, 'hex-desc')).toEqual([
			'#ff0000',
			'#00ff00',
			'#0000ff',
		]);
	});

	it('sorts by lightness', () => {
		const shades = ['#ffffff', '#000000', '#808080'];
		expect(sortColors(shades, 'lightness-asc')).toEqual([
			'#000000',
			'#808080',
			'#ffffff',
		]);
		expect(sortColors(shades, 'lightness-desc')).toEqual([
			'#ffffff',
			'#808080',
			'#000000',
		]);
	});

	it('sorts by saturation', () => {
		const mixed = ['#808080', '#ff0000', '#bf4040'];
		expect(sortColors(mixed, 'saturation-asc')).toEqual([
			'#808080',
			'#bf4040',
			'#ff0000',
		]);
		expect(sortColors(mixed, 'saturation-desc')).toEqual([
			'#ff0000',
			'#bf4040',
			'#808080',
		]);
	});

	it('keeps unparseable values stable', () => {
		const withJunk = ['#ff0000', 'not-a-color', '#0000ff'];
		const sorted = sortColors(withJunk, 'hue-asc');
		expect(sorted).toHaveLength(3);
		expect(sorted).toContain('not-a-color');
	});
});
