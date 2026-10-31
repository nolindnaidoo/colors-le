import { describe, expect, test } from 'vitest';
import {
	detectColorFormat,
	isValidColorFormat,
	parseColor,
	parseColorToHSL,
	type RgbColor,
	rgbToHex,
	rgbToHsl,
	rgbToHslString,
	rgbToRgbString,
} from './colorConversion';

describe('parseColor', () => {
	test('should parse hex colors - 3 digit', () => {
		const result = parseColor('#abc');
		expect(result).toEqual({ r: 170, g: 187, b: 204 });
	});

	test('should parse hex colors - 6 digit', () => {
		const result = parseColor('#aabbcc');
		expect(result).toEqual({ r: 170, g: 187, b: 204 });
	});

	test('should parse hex colors - 8 digit with alpha', () => {
		const result = parseColor('#aabbcc80');
		expect(result).toEqual({ r: 170, g: 187, b: 204, a: 0.5019607843137255 });
	});

	test('should parse rgb colors', () => {
		const result = parseColor('rgb(255, 128, 64)');
		expect(result).toEqual({ r: 255, g: 128, b: 64 });
	});

	test('should parse rgba colors', () => {
		const result = parseColor('rgba(255, 128, 64, 0.5)');
		expect(result).toEqual({ r: 255, g: 128, b: 64, a: 0.5 });
	});

	test('should parse hsl colors', () => {
		const result = parseColor('hsl(0, 100%, 50%)');
		expect(result).toEqual({ r: 255, g: 0, b: 0 });
	});

	test('should parse hsla colors', () => {
		const result = parseColor('hsla(0, 100%, 50%, 0.5)');
		expect(result).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
	});

	test('should return null for invalid colors', () => {
		expect(parseColor('invalid')).toBeNull();
		expect(parseColor('notacolor')).toBeNull();
		expect(parseColor('')).toBeNull();
	});

	test('should handle colors with extra whitespace', () => {
		const result = parseColor('  rgb(255, 128, 64)  ');
		expect(result).toEqual({ r: 255, g: 128, b: 64 });
	});
});

describe('rgbToHex', () => {
	test('should convert RGB to hex', () => {
		const rgb: RgbColor = { r: 255, g: 128, b: 64 };
		expect(rgbToHex(rgb)).toBe('#ff8040');
	});

	test('should convert RGB with alpha to hex', () => {
		const rgb: RgbColor = { r: 255, g: 128, b: 64, a: 0.5 };
		expect(rgbToHex(rgb)).toBe('#ff804080');
	});

	test('should handle black', () => {
		const rgb: RgbColor = { r: 0, g: 0, b: 0 };
		expect(rgbToHex(rgb)).toBe('#000000');
	});

	test('should handle white', () => {
		const rgb: RgbColor = { r: 255, g: 255, b: 255 };
		expect(rgbToHex(rgb)).toBe('#ffffff');
	});

	test('should not add alpha for fully opaque colors', () => {
		const rgb: RgbColor = { r: 255, g: 128, b: 64, a: 1 };
		expect(rgbToHex(rgb)).toBe('#ff8040');
	});
});

describe('rgbToHsl', () => {
	test('should convert red to HSL', () => {
		const rgb: RgbColor = { r: 255, g: 0, b: 0 };
		const result = rgbToHsl(rgb);
		expect(result.h).toBe(0);
		expect(result.s).toBe(100);
		expect(result.l).toBe(50);
	});

	test('should convert green to HSL', () => {
		const rgb: RgbColor = { r: 0, g: 255, b: 0 };
		const result = rgbToHsl(rgb);
		expect(result.h).toBe(120);
		expect(result.s).toBe(100);
		expect(result.l).toBe(50);
	});

	test('should convert blue to HSL', () => {
		const rgb: RgbColor = { r: 0, g: 0, b: 255 };
		const result = rgbToHsl(rgb);
		expect(result.h).toBe(240);
		expect(result.s).toBe(100);
		expect(result.l).toBe(50);
	});

	test('should convert black to HSL', () => {
		const rgb: RgbColor = { r: 0, g: 0, b: 0 };
		const result = rgbToHsl(rgb);
		expect(result.h).toBe(0);
		expect(result.s).toBe(0);
		expect(result.l).toBe(0);
	});

	test('should convert white to HSL', () => {
		const rgb: RgbColor = { r: 255, g: 255, b: 255 };
		const result = rgbToHsl(rgb);
		expect(result.h).toBe(0);
		expect(result.s).toBe(0);
		expect(result.l).toBe(100);
	});

	test('should convert gray to HSL', () => {
		const rgb: RgbColor = { r: 128, g: 128, b: 128 };
		const result = rgbToHsl(rgb);
		expect(result.h).toBe(0);
		expect(result.s).toBe(0);
		expect(result.l).toBe(50);
	});

	test('should preserve alpha channel', () => {
		const rgb: RgbColor = { r: 255, g: 0, b: 0, a: 0.5 };
		const result = rgbToHsl(rgb);
		expect(result.a).toBe(0.5);
	});
});

describe('rgbToRgbString', () => {
	test('should convert RGB to string', () => {
		const rgb: RgbColor = { r: 255, g: 128, b: 64 };
		expect(rgbToRgbString(rgb)).toBe('rgb(255, 128, 64)');
	});

	test('should convert RGBA to string', () => {
		const rgb: RgbColor = { r: 255, g: 128, b: 64, a: 0.5 };
		expect(rgbToRgbString(rgb)).toBe('rgba(255, 128, 64, 0.5)');
	});

	test('should handle black', () => {
		const rgb: RgbColor = { r: 0, g: 0, b: 0 };
		expect(rgbToRgbString(rgb)).toBe('rgb(0, 0, 0)');
	});

	test('should handle white', () => {
		const rgb: RgbColor = { r: 255, g: 255, b: 255 };
		expect(rgbToRgbString(rgb)).toBe('rgb(255, 255, 255)');
	});
});

describe('rgbToHslString', () => {
	test('should convert RGB to HSL string', () => {
		const rgb: RgbColor = { r: 255, g: 0, b: 0 };
		expect(rgbToHslString(rgb)).toBe('hsl(0, 100%, 50%)');
	});

	test('should convert RGBA to HSLA string', () => {
		const rgb: RgbColor = { r: 255, g: 0, b: 0, a: 0.5 };
		expect(rgbToHslString(rgb)).toBe('hsla(0, 100%, 50%, 0.5)');
	});

	test('should handle black', () => {
		const rgb: RgbColor = { r: 0, g: 0, b: 0 };
		expect(rgbToHslString(rgb)).toBe('hsl(0, 0%, 0%)');
	});

	test('should handle white', () => {
		const rgb: RgbColor = { r: 255, g: 255, b: 255 };
		expect(rgbToHslString(rgb)).toBe('hsl(0, 0%, 100%)');
	});
});

describe('detectColorFormat', () => {
	test('should detect hex format', () => {
		expect(detectColorFormat('#abc')).toBe('hex');
		expect(detectColorFormat('#aabbcc')).toBe('hex');
		expect(detectColorFormat('#aabbccdd')).toBe('hex');
	});

	test('should detect rgb format', () => {
		expect(detectColorFormat('rgb(255, 128, 64)')).toBe('rgb');
	});

	test('should detect rgba format', () => {
		expect(detectColorFormat('rgba(255, 128, 64, 0.5)')).toBe('rgba');
	});

	test('should detect hsl format', () => {
		expect(detectColorFormat('hsl(0, 100%, 50%)')).toBe('hsl');
	});

	test('should detect hsla format', () => {
		expect(detectColorFormat('hsla(0, 100%, 50%, 0.5)')).toBe('hsla');
	});

	test('should return unknown for invalid formats', () => {
		expect(detectColorFormat('invalid')).toBe('unknown');
		expect(detectColorFormat('notacolor')).toBe('unknown');
		expect(detectColorFormat('')).toBe('unknown');
	});

	test('should handle colors with extra whitespace', () => {
		expect(detectColorFormat('  #abc  ')).toBe('hex');
		expect(detectColorFormat('  rgb(255, 128, 64)  ')).toBe('rgb');
	});
});

describe('HSL to RGB conversion edge cases', () => {
	test('should convert HSL with hue in different ranges', () => {
		// Test all 6 ranges of the hue spectrum
		const testCases = [
			{ hsl: 'hsl(30, 100%, 50%)', expected: { r: 255, g: 128, b: 0 } }, // Range 1
			{ hsl: 'hsl(90, 100%, 50%)', expected: { r: 128, g: 255, b: 0 } }, // Range 2
			{ hsl: 'hsl(150, 100%, 50%)', expected: { r: 0, g: 255, b: 128 } }, // Range 3
			{ hsl: 'hsl(210, 100%, 50%)', expected: { r: 0, g: 128, b: 255 } }, // Range 4
			{ hsl: 'hsl(270, 100%, 50%)', expected: { r: 128, g: 0, b: 255 } }, // Range 5
			{ hsl: 'hsl(330, 100%, 50%)', expected: { r: 255, g: 0, b: 128 } }, // Range 6
		];

		for (const { hsl, expected } of testCases) {
			const result = parseColor(hsl);
			expect(result).toEqual(expected);
		}
	});

	test('should handle HSL with low saturation', () => {
		const result = parseColor('hsl(0, 0%, 50%)');
		expect(result).toEqual({ r: 128, g: 128, b: 128 });
	});

	test('should handle HSL with high lightness', () => {
		const result = parseColor('hsl(0, 100%, 100%)');
		expect(result).toEqual({ r: 255, g: 255, b: 255 });
	});

	test('should handle HSL with low lightness', () => {
		const result = parseColor('hsl(0, 100%, 0%)');
		expect(result).toEqual({ r: 0, g: 0, b: 0 });
	});
});

describe('what Extract reports, the readers read', () => {
	// The readers behind Validate, Filter, Analyze and Convert lagged the
	// extractor: a 4-digit hex and a keyword were found and then called
	// invalid, a functional call in capitals could not be read, and only a
	// 6-digit hex, a legacy hsl() or modern syntax had an HSL at all.
	test('parses a four-digit hex with its alpha', () => {
		expect(parseColor('#f0a8')).toEqual({ r: 255, g: 0, b: 170, a: 136 / 255 });
	});

	test('parses a functional call in either case', () => {
		expect(parseColor('RGB(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3 });
		expect(parseColor('HSL(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0 });
	});

	test('parses the keywords, and transparent as a see-through black', () => {
		expect(parseColor('red')).toEqual({ r: 255, g: 0, b: 0 });
		expect(parseColor('Grey')).toEqual({ r: 128, g: 128, b: 128 });
		expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
	});

	test('does not read a prototype name as a keyword', () => {
		for (const name of ['constructor', '__proto__', 'toString']) {
			expect(parseColor(name), name).toBeNull();
			expect(isValidColorFormat(name), name).toBe(false);
		}
	});

	test('calls valid exactly what it can read', () => {
		for (const value of [
			'red',
			'grey',
			'transparent',
			'#f0a8',
			'#F0A',
			'RGB(1, 2, 3)',
			'oklch(70% 0.1 250)',
		]) {
			expect(isValidColorFormat(value), value).toBe(true);
		}
		for (const value of ['blurple', '#12345', 'rgb(1, 2)', '']) {
			expect(isValidColorFormat(value), value).toBe(false);
		}
	});

	test('derives an HSL from every notation', () => {
		expect(parseColorToHSL('rgb(255, 0, 0)')).toEqual({ h: 0, s: 100, l: 50 });
		expect(parseColorToHSL('rgba(0, 0, 0, 0.5)')).toEqual({ h: 0, s: 0, l: 0 });
		expect(parseColorToHSL('hsla(210, 50%, 40%, 0.8)')).toEqual({
			h: 210,
			s: 50,
			l: 40,
		});
		expect(parseColorToHSL('#f00')).toEqual({ h: 0, s: 100, l: 50 });
		expect(parseColorToHSL('#ff000080')).toEqual({ h: 0, s: 100, l: 50 });
		expect(parseColorToHSL('#f00f')).toEqual({ h: 0, s: 100, l: 50 });
		expect(parseColorToHSL('navy')).toEqual({ h: 240, s: 100, l: 25 });
		expect(parseColorToHSL('transparent')).toEqual({ h: 0, s: 0, l: 0 });
		expect(parseColorToHSL('notacolour')).toBeNull();
	});

	test('keeps the hue on the wheel', () => {
		// Rounding took a hue just under 360 to 360, which no hue range
		// includes and the red check reads as its own sector.
		const { h } = rgbToHsl({ r: 255, g: 0, b: 1 });
		expect(h).toBeGreaterThanOrEqual(0);
		expect(h).toBeLessThan(360);
	});
});
