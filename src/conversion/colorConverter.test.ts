import { describe, expect, it } from 'vitest';
import type { Color } from '../types';
import {
	convertColor,
	convertColors,
	getAvailableFormats,
	getContrastRatio,
	validateColorFormat,
} from './colorConverter';

function color(value: string, format: Color['format'] = 'hex'): Color {
	return { value, format };
}

describe('convertColor', () => {
	it('converts hex to rgb', () => {
		const result = convertColor(color('#ff0000'), { targetFormat: 'rgb' });
		expect(result.success).toBe(true);
		expect(result.converted).toBe('rgb(255, 0, 0)');
	});

	it('converts rgb to hex', () => {
		const result = convertColor(color('rgb(255, 0, 0)', 'rgb'), {
			targetFormat: 'hex',
		});
		expect(result.success).toBe(true);
		expect(result.converted).toBe('#ff0000');
	});

	it('converts hex to hsl', () => {
		const result = convertColor(color('#ff0000'), { targetFormat: 'hsl' });
		expect(result.success).toBe(true);
		expect(result.converted).toContain('hsl(');
	});

	it('respects uppercase and short hex options', () => {
		const upper = convertColor(color('rgb(255, 0, 0)', 'rgb'), {
			targetFormat: 'hex',
			uppercase: true,
		});
		expect(upper.converted).toBe('#FF0000');

		const short = convertColor(color('rgb(255, 0, 0)', 'rgb'), {
			targetFormat: 'hex',
			shortHex: true,
		});
		expect(short.converted).toBe('#f00');
	});

	it('fails on unparseable input', () => {
		const result = convertColor(color('not-a-color', 'unknown'), {
			targetFormat: 'hex',
		});
		expect(result.success).toBe(false);
	});
});

describe('convertColors', () => {
	it('converts a batch and preserves order', () => {
		const results = convertColors([color('#ff0000'), color('#00ff00')], {
			targetFormat: 'rgb',
		});
		expect(results).toHaveLength(2);
		expect(results[0]?.converted).toBe('rgb(255, 0, 0)');
	});
});

describe('getAvailableFormats', () => {
	it('lists the supported target formats', () => {
		const formats = getAvailableFormats();
		expect(formats).toContain('hex');
		expect(formats).toContain('rgb');
		expect(formats).toContain('hsl');
	});
});

describe('validateColorFormat', () => {
	it('accepts values matching the format', () => {
		expect(validateColorFormat('#ff0000', 'hex')).toBe(true);
		expect(validateColorFormat('rgb(1, 2, 3)', 'rgb')).toBe(true);
	});

	it('rejects mismatches', () => {
		expect(validateColorFormat('#ff0000', 'rgb')).toBe(false);
	});
});

describe('getContrastRatio', () => {
	it('is 21 for black on white', () => {
		expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
	});

	it('is 1 for identical colors', () => {
		expect(getContrastRatio('#808080', '#808080')).toBeCloseTo(1, 1);
	});
});
