import { describe, expect, it } from 'vitest';
import { isModernColor, parseModernColor } from './cssColor';

const pixel = (value: string) => {
	const c = parseModernColor(value);
	return c && [c.r, c.g, c.b, c.a];
};

describe('parseModernColor', () => {
	it('reads every modern form of red as red', () => {
		for (const value of [
			'rgb(255 0 0)',
			'RGB(100% 0% 0%)',
			'hsl(0deg 100% 50%)',
			'hwb(0 0% 0%)',
			'lab(54.29 80.8 69.89)',
			'lch(54.29% 106.84 40.85)',
			'oklab(0.628 0.2249 0.1258)',
			'oklch(62.8% 0.2577 29.23)',
			'color(srgb 1 0 0)',
			'color(display-p3 1 0 0)',
			'color(xyz-d65 0.4124 0.2126 0.0193)',
		]) {
			expect(pixel(value), value).toEqual([255, 0, 0, 1]);
		}
	});

	it('reads alpha, hue units and none', () => {
		expect(pixel('rgb(255 0 0 / 50%)')).toEqual([255, 0, 0, 0.5]);
		expect(pixel('hsl(0.5turn 50% 50% / .3)')).toEqual([64, 191, 191, 0.3]);
		expect(pixel('oklch(none 0 0)')).toEqual([0, 0, 0, 1]);
		expect(pixel('hsl(3.14159rad 50% 50%)')).toEqual([64, 191, 191, 1]);
	});

	it('clips a colour outside sRGB', () => {
		expect(pixel('color(rec2020 0 1 0)')).toEqual([0, 255, 0, 1]);
	});

	it('refuses what is not a modern colour', () => {
		for (const value of [
			'rgb(255, 0, 0)',
			'rgb(255 0 0 0)',
			'rgb(from red r g b)',
			'rgb(var(--x) 0 0)',
			'lab(1 2)',
			'color(1 2 3)',
			'color(cmyk 1 2 3)',
			'hsl(0 100% 50% /)',
			'rgb(1.2.3 0 0)',
			'lch(50 50 40%)',
			'',
		]) {
			expect(isModernColor(value), value).toBe(false);
		}
	});
});
