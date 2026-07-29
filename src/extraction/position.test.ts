import { describe, expect, it } from 'vitest';
import { createPositionIndex, lineTextAt } from './position';

describe('createPositionIndex', () => {
	it('maps offsets on the first line', () => {
		const at = createPositionIndex('abc\ndef');
		expect(at(0)).toEqual({ line: 1, column: 1 });
		expect(at(2)).toEqual({ line: 1, column: 3 });
	});

	it('maps offsets after newlines', () => {
		const at = createPositionIndex('abc\ndef\nghi');
		expect(at(4)).toEqual({ line: 2, column: 1 });
		expect(at(8)).toEqual({ line: 3, column: 1 });
		expect(at(10)).toEqual({ line: 3, column: 3 });
	});

	it('clamps out-of-range offsets', () => {
		const at = createPositionIndex('ab');
		expect(at(-5)).toEqual({ line: 1, column: 1 });
		expect(at(99)).toEqual({ line: 1, column: 3 });
	});

	it('handles empty content', () => {
		const at = createPositionIndex('');
		expect(at(0)).toEqual({ line: 1, column: 1 });
	});

	it('handles CRLF content (column counts include \\r)', () => {
		const at = createPositionIndex('ab\r\ncd');
		expect(at(4)).toEqual({ line: 2, column: 1 });
	});
});

describe('lineTextAt', () => {
	it('returns the full line containing the offset', () => {
		expect(lineTextAt('abc\ndef\nghi', 5)).toBe('def');
		expect(lineTextAt('abc\ndef\nghi', 0)).toBe('abc');
		expect(lineTextAt('abc\ndef\nghi', 9)).toBe('ghi');
	});
});
