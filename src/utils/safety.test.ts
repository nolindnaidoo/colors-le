import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_resetMockState,
	_respondToWarning,
} from '../__mocks__/vscode';
import { CONFIG_DEFAULTS } from '../config/config';
import type { Configuration } from '../types';
import {
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
		expect(result.message).toContain('exceeds safety threshold');
	});

	it('warns on many lines without blocking', () => {
		const config = { ...baseConfig, safetyLargeOutputLinesThreshold: 10 };
		const result = handleSafetyChecks(doc('a\n'.repeat(50)), config);
		expect(result.proceed).toBe(true);
		expect(result.warnings.some((w) => w.includes('Large file'))).toBe(true);
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
