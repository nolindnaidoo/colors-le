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

describe('convertColor: every target format', () => {
	// The converter switches on targetFormat; each arm has its own writer and
	// only three of the six were exercised.
	const RED = color('#ff0000');

	it('writes rgba', () => {
		const r = convertColor(RED, { targetFormat: 'rgba' });
		expect(r.success).toBe(true);
		expect(r.converted).toBe('rgba(255, 0, 0, 1)');
	});

	it('writes hsla', () => {
		const r = convertColor(RED, { targetFormat: 'hsla' });
		expect(r.success).toBe(true);
		expect(r.converted).toContain('hsla(');
	});

	it('writes oklch', () => {
		const r = convertColor(RED, { targetFormat: 'oklch' });
		expect(r.success).toBe(true);
		expect(r.converted).toContain('oklch(');
	});
});

describe('convertColor: input parsing', () => {
	it('parses a three-digit hex', () => {
		const r = convertColor(color('#f00'), { targetFormat: 'rgb' });
		expect(r.converted).toBe('rgb(255, 0, 0)');
	});

	it('parses an eight-digit hex and keeps the alpha', () => {
		const r = convertColor(color('#ff000080'), { targetFormat: 'rgba' });
		expect(r.success).toBe(true);
		expect(r.converted).toMatch(/^rgba\(255, 0, 0, /);
	});

	it('parses rgba input', () => {
		const r = convertColor(color('rgba(255, 0, 0, 0.5)', 'rgba'), {
			targetFormat: 'hex',
		});
		expect(r.success).toBe(true);
	});

	it('parses hsl input', () => {
		const r = convertColor(color('hsl(0, 100%, 50%)', 'hsl'), {
			targetFormat: 'rgb',
		});
		expect(r.converted).toBe('rgb(255, 0, 0)');
	});

	it('parses hsla input including its alpha', () => {
		const r = convertColor(color('hsla(0, 100%, 50%, 0.25)', 'hsla'), {
			targetFormat: 'rgba',
		});
		expect(r.success).toBe(true);
		expect(r.converted).toContain('0.25');
	});

	it('parses a named colour', () => {
		const r = convertColor(color('red', 'named'), { targetFormat: 'rgb' });
		expect(r.converted).toBe('rgb(255, 0, 0)');
	});

	it('rejects an unknown name', () => {
		const r = convertColor(color('notacolour', 'named'), {
			targetFormat: 'rgb',
		});
		expect(r.success).toBe(false);
	});

	it('rejects a malformed hex length', () => {
		const r = convertColor(color('#ff00'), { targetFormat: 'rgb' });
		expect(r.success).toBe(false);
	});
});

describe('convertColor: option handling', () => {
	it('drops alpha when preserveAlpha is off', () => {
		const r = convertColor(color('rgba(255, 0, 0, 0.5)', 'rgba'), {
			targetFormat: 'rgba',
			preserveAlpha: false,
		});
		expect(r.success).toBe(true);
	});

	it('rounds values when asked', () => {
		const r = convertColor(color('hsl(0, 100%, 50%)', 'hsl'), {
			targetFormat: 'hsl',
			roundValues: true,
		});
		expect(r.converted).not.toMatch(/\.\d{3}/);
	});
});

describe('validateColorFormat: each format', () => {
	it('recognises every supported format', () => {
		expect(validateColorFormat('#ff0000', 'hex')).toBe(true);
		expect(validateColorFormat('rgb(1, 2, 3)', 'rgb')).toBe(true);
		expect(validateColorFormat('rgba(1, 2, 3, 1)', 'rgba')).toBe(true);
		expect(validateColorFormat('hsl(0, 1%, 2%)', 'hsl')).toBe(true);
		expect(validateColorFormat('hsla(0, 1%, 2%, 1)', 'hsla')).toBe(true);
	});

	it('rejects an unknown format name', () => {
		expect(validateColorFormat('#ff0000', 'nonsense')).toBe(false);
	});
});

describe('getContrastRatio: edge inputs', () => {
	it('returns a ratio for two mid greys', () => {
		expect(getContrastRatio('#777777', '#888888')).toBeGreaterThan(1);
	});

	it('handles an unparseable colour without throwing', () => {
		expect(() => getContrastRatio('notacolour', '#ffffff')).not.toThrow();
	});
});

describe('convertColors: batch behaviour', () => {
	it('reports per-item failure without aborting the batch', () => {
		const results = convertColors(
			[color('#ff0000'), color('nope'), color('#00ff00')],
			{ targetFormat: 'rgb' },
		);
		expect(results).toHaveLength(3);
		expect(results[0]?.success).toBe(true);
		expect(results[1]?.success).toBe(false);
		expect(results[2]?.success).toBe(true);
	});

	it('returns an empty array for no input', () => {
		expect(convertColors([], { targetFormat: 'rgb' })).toHaveLength(0);
	});
});
