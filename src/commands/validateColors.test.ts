import { describe, expect, it } from 'vitest';
import type { Color } from '../types';
import { validateColors } from './validate';

/**
 * The validation engine, exercised directly: the command wraps it in a
 * prompt sequence, and the report it writes is read elsewhere.
 */

function color(value: string, format: Color['format'] = 'hex'): Color {
	return { value, format };
}

describe('validateColors: format', () => {
	it('calls every notation the extractor reports valid', () => {
		// A keyword was "Invalid color format" in every Validate report, and so
		// was a four-digit hex; a functional call in capitals could not be read.
		const report = validateColors(
			[
				color('red', 'named'),
				color('transparent', 'named'),
				color('#f0a8'),
				color('RGB(1, 2, 3)', 'rgb'),
				color('oklch(70% 0.1 250)', 'oklch'),
			],
			{ checkFormat: true },
		);
		expect(report.colors.flatMap((result) => result.issues)).toEqual([]);
		expect(report.summary).toEqual({
			total: 5,
			valid: 5,
			invalid: 0,
			warnings: 0,
			errors: 0,
		});
	});

	it('reports a contrast it could not compute as that, not as a failing ratio', () => {
		const report = validateColors([color('notacolour', 'unknown')], {
			checkContrast: true,
			contrastBackground: '#ffffff',
			minContrastAA: 4.5,
		});
		const result = report.colors[0];
		expect(result?.contrastRatio).toBeUndefined();
		expect(result?.accessibilityLevel).toBeUndefined();
		expect(result?.issues).toEqual([
			{
				type: 'contrast',
				severity: 'error',
				message:
					'Contrast ratio could not be computed: notacolour is not a color this reads',
				suggestion: 'Ensure both colors are in valid formats',
			},
		]);
	});

	it('still names a value that is not a colour', () => {
		const report = validateColors([color('notacolour', 'unknown')], {
			checkFormat: true,
		});
		expect(report.colors[0]?.valid).toBe(false);
		expect(report.colors[0]?.issues.map((issue) => issue.message)).toEqual([
			'Invalid color format: notacolour',
		]);
	});
});
