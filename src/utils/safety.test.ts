import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_resetMockState,
	_respondToWarning,
} from '../__mocks__/vscode';
import { CONFIG_DEFAULTS } from '../config/config';
import type { Configuration } from '../types';
import {
	confirmLargeOutput,
	handleSafetyChecks,
	handleSafetyChecksWithUserConfirmation,
} from './safety';

const baseConfig: Configuration = { ...CONFIG_DEFAULTS };

function doc(content: string) {
	// The mock document is structurally compatible with vscode.TextDocument
	// for everything safety checks touch (getText only).
	return _createDocument({ content }) as never;
}

describe('handleSafetyChecks', () => {
	beforeEach(() => _resetMockState());

	it('passes small documents', () => {
		const result = handleSafetyChecks(doc('a { color: #fff; }'), baseConfig);
		expect(result.proceed).toBe(true);
		expect(result.warnings).toEqual([]);
	});

	it('skips all checks when safety is disabled', () => {
		const config = { ...baseConfig, safetyEnabled: false };
		const huge = 'x'.repeat(2_000_000);
		expect(handleSafetyChecks(doc(huge), config).proceed).toBe(true);
	});

	it('blocks documents over the file-size threshold', () => {
		const config = { ...baseConfig, safetyFileSizeWarnBytes: 1000 };
		const result = handleSafetyChecks(doc('x'.repeat(2000)), config);
		expect(result.proceed).toBe(false);
		expect(result.message).toContain('exceeds the safety threshold');
	});

	it('counts bytes, not UTF-16 units, as a folder scan does', () => {
		const config = { ...baseConfig, safetyFileSizeWarnBytes: 1000 };
		// 600 characters, 1,200 bytes.
		const result = handleSafetyChecks(doc('é'.repeat(600)), config);
		expect(result.proceed).toBe(false);
		expect(result.message).toContain('(1200 bytes)');
	});

	it("leaves the document's line count alone: the setting counts result lines", () => {
		const config = { ...baseConfig, safetyLargeOutputLinesThreshold: 10 };
		const result = handleSafetyChecks(doc('a\n'.repeat(50)), config);
		expect(result.proceed).toBe(true);
		expect(result.warnings).toEqual([]);
	});

	it('warns on very color-dense content', () => {
		const dense = '#fff '.repeat(1500);
		const result = handleSafetyChecks(doc(dense), baseConfig);
		expect(
			result.warnings.some((w) => w.includes('Large number of colors')),
		).toBe(true);
	});
});

describe('handleSafetyChecksWithUserConfirmation', () => {
	beforeEach(() => _resetMockState());

	it('returns blocked result when override not allowed', async () => {
		const config = { ...baseConfig, safetyFileSizeWarnBytes: 1000 };
		const result = await handleSafetyChecksWithUserConfirmation(
			doc('x'.repeat(2000)),
			config,
		);
		expect(result.proceed).toBe(false);
	});

	it('proceeds when the user confirms the override', async () => {
		_respondToWarning((items) =>
			items.find((item) => item === 'Continue Anyway'),
		);
		const config = { ...baseConfig, safetyFileSizeWarnBytes: 1000 };
		const result = await handleSafetyChecksWithUserConfirmation(
			doc('x'.repeat(2000)),
			config,
			{ allowOverride: true },
		);
		expect(result.proceed).toBe(true);
		expect(result.message).toContain('override approved');
	});

	it('stays blocked when the user cancels', async () => {
		_respondToWarning(() => 'Cancel');
		const config = { ...baseConfig, safetyFileSizeWarnBytes: 1000 };
		const result = await handleSafetyChecksWithUserConfirmation(
			doc('x'.repeat(2000)),
			config,
			{ allowOverride: true },
		);
		expect(result.proceed).toBe(false);
	});
});

describe('confirmLargeOutput', () => {
	beforeEach(() => _resetMockState());
	const config = { ...baseConfig, safetyLargeOutputLinesThreshold: 100 };

	it('asks nothing at or under the threshold, or with safety off', async () => {
		let asked = 0;
		_respondToWarning(() => {
			asked += 1;
			return undefined;
		});
		expect(await confirmLargeOutput(100, config)).toBe(true);
		expect(
			await confirmLargeOutput(500, { ...config, safetyEnabled: false }),
		).toBe(true);
		expect(asked).toBe(0);
	});

	it('asks above it, and goes on only when told to', async () => {
		_respondToWarning((items) =>
			items.find((item) => item === 'Continue Anyway'),
		);
		expect(await confirmLargeOutput(101, config)).toBe(true);
		_respondToWarning(() => undefined);
		expect(await confirmLargeOutput(101, config)).toBe(false);
	});
});
