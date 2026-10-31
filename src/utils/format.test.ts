import { describe, expect, it } from 'vitest';
import { formatDuration } from './format';

describe('formatDuration', () => {
	it('formats sub-second durations in ms', () => {
		expect(formatDuration(0)).toBe('0ms');
		expect(formatDuration(999)).toBe('999ms');
	});

	it('rounds what performance.now() hands it', () => {
		// The reports printed the raw difference of two high-resolution
		// timestamps: "Analysis Time: 2.8999999999999986ms".
		expect(formatDuration(2.8999999999999986)).toBe('3ms');
		expect(formatDuration(999.6)).toBe('1s');
	});

	it('formats seconds', () => {
		expect(formatDuration(1000)).toBe('1s');
		expect(formatDuration(59_000)).toBe('59s');
	});

	it('formats minutes and hours', () => {
		expect(formatDuration(61_000)).toBe('1m 1s');
		expect(formatDuration(3_661_000)).toBe('1h 1m 1s');
	});
});
