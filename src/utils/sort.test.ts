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

	it('orders hex by its digits, in no locale', () => {
		// `localeCompare` sorted by the host's collation: Danish reads `aa`
		// as a letter after `z`, so `#aa0000` came after `#ff0000`, and
		// English puts a lowercase letter before the same letter in upper
		// case, so one value in two spellings swapped places. The order is
		// the digits' own, case folded, and two spellings of one value keep
		// the order they came in.
		expect(sortColors(['#ff0000', '#AA0000', '#0a0a0a'], 'hex-asc')).toEqual([
			'#0a0a0a',
			'#AA0000',
			'#ff0000',
		]);
		expect(sortColors(['#FF0000', '#ff0000'], 'hex-asc')).toEqual([
			'#FF0000',
			'#ff0000',
		]);
		expect(sortColors(['#FF0000', '#ff0000'], 'hex-desc')).toEqual([
			'#FF0000',
			'#ff0000',
		]);
	});

	it('keeps unparseable values stable', () => {
		const withJunk = ['#ff0000', 'not-a-color', '#0000ff'];
		const sorted = sortColors(withJunk, 'hue-asc');
		expect(sorted).toHaveLength(3);
		expect(sorted).toContain('not-a-color');
	});
});
