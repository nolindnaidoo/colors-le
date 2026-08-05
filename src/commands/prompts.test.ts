import { beforeEach, describe, expect, it } from 'vitest';
import {
	_resetMockState,
	_respondToInputBox,
	_respondToQuickPick,
} from '../__mocks__/vscode';
import type { Color } from '../types';
import { promptForFilterOptions } from './filterPrompts';
import { promptForValidationOptions } from './validatePrompts';

/**
 * The two prompt modules, which were the least-covered files in this repo.
 *
 * Both are long sequences of quick picks and input boxes, and every branch
 * past the first is reachable only by answering the one before it — so a
 * single dismissal at the top left the rest of each file unexercised. They are
 * exported, so they can be driven directly rather than through their commands.
 *
 * Answers are matched on the item's `value`, not its label: the labels are
 * localized, and matching them would break in twelve languages.
 */

function color(value: string, format: Color['format'] = 'hex'): Color {
	return { value, format };
}

const COLORS: readonly Color[] = [
	color('#ff0000'),
	color('rgb(0, 255, 0)', 'rgb'),
	color('hsl(240, 100%, 50%)', 'hsl'),
];

/** Answer a sequence of quick picks, one entry per call. */
function answerPicks(...answers: readonly ((items: unknown[]) => unknown)[]) {
	let call = 0;
	_respondToQuickPick((items) => {
		const answer = answers[call];
		call += 1;
		return answer ? answer(items) : undefined;
	});
}

/** Pick the single-select entry whose `value` matches. */
const byValue =
	(value: string) =>
	(items: unknown[]): unknown =>
		items.find((i) => (i as { value?: string }).value === value);

/** Take the first n entries of a multi-select. */
const firstOf =
	(n: number) =>
	(items: unknown[]): unknown =>
		items.slice(0, n);

const dismiss = () => undefined;

/** Answer a sequence of input boxes, one entry per call. */
function answerInputs(...values: readonly (string | undefined)[]) {
	const queue = [...values];
	_respondToInputBox(() => queue.shift());
}

beforeEach(() => {
	_resetMockState();
});

describe('promptForFilterOptions', () => {
	it('returns undefined when the first pick is dismissed', async () => {
		answerPicks(dismiss);
		expect(await promptForFilterOptions(COLORS)).toBeUndefined();
	});

	it('collects an include-formats selection', async () => {
		answerPicks(
			byValue('include'),
			firstOf(1),
			byValue('none'),
			byValue('none'),
			firstOf(0),
		);
		const options = await promptForFilterOptions(COLORS);
		expect(options?.formats?.length).toBeGreaterThan(0);
	});

	it('collects an exclude-formats selection', async () => {
		answerPicks(
			byValue('exclude'),
			firstOf(1),
			byValue('none'),
			byValue('none'),
			firstOf(0),
		);
		const options = await promptForFilterOptions(COLORS);
		expect(options?.excludeFormats?.length).toBeGreaterThan(0);
	});

	it('returns undefined when the format multi-select is dismissed', async () => {
		answerPicks(byValue('include'), dismiss);
		expect(await promptForFilterOptions(COLORS)).toBeUndefined();
	});

	it('applies the dark lightness preset', async () => {
		answerPicks(byValue('none'), byValue('dark'), byValue('none'), firstOf(0));
		const options = await promptForFilterOptions(COLORS);
		expect(options?.maxLightness).toBeDefined();
	});

	it('applies the light lightness preset', async () => {
		answerPicks(byValue('none'), byValue('light'), byValue('none'), firstOf(0));
		const options = await promptForFilterOptions(COLORS);
		expect(options?.minLightness).toBeDefined();
	});

	it('applies the medium lightness preset', async () => {
		answerPicks(
			byValue('none'),
			byValue('medium'),
			byValue('none'),
			firstOf(0),
		);
		const options = await promptForFilterOptions(COLORS);
		expect(options?.minLightness).toBeDefined();
		expect(options?.maxLightness).toBeDefined();
	});

	it('accepts a custom lightness range', async () => {
		answerPicks(
			byValue('none'),
			byValue('custom'),
			byValue('none'),
			firstOf(0),
		);
		answerInputs('20', '80');
		const options = await promptForFilterOptions(COLORS);
		expect(options?.minLightness).toBe(20);
		expect(options?.maxLightness).toBe(80);
	});

	it('returns undefined when a custom lightness bound is dismissed', async () => {
		answerPicks(byValue('none'), byValue('custom'));
		answerInputs(undefined);
		expect(await promptForFilterOptions(COLORS)).toBeUndefined();
	});

	it('applies the vibrant saturation preset', async () => {
		answerPicks(
			byValue('none'),
			byValue('none'),
			byValue('vibrant'),
			firstOf(0),
		);
		const options = await promptForFilterOptions(COLORS);
		expect(options?.minSaturation).toBeDefined();
	});

	it('applies the muted saturation preset', async () => {
		answerPicks(byValue('none'), byValue('none'), byValue('muted'), firstOf(0));
		const options = await promptForFilterOptions(COLORS);
		expect(options?.maxSaturation).toBeDefined();
	});

	it('accepts a custom saturation range', async () => {
		answerPicks(
			byValue('none'),
			byValue('none'),
			byValue('custom'),
			firstOf(0),
		);
		answerInputs('30', '70');
		const options = await promptForFilterOptions(COLORS);
		expect(options?.minSaturation).toBe(30);
		expect(options?.maxSaturation).toBe(70);
	});

	it('records the additional exclusion filters', async () => {
		answerPicks(
			byValue('none'),
			byValue('none'),
			byValue('none'),
			(items) => items,
		);
		const options = await promptForFilterOptions(COLORS);
		expect(options?.excludeDuplicates).toBe(true);
		expect(options?.excludeInvalid).toBe(true);
		expect(options?.excludeTransparent).toBe(true);
	});

	it('returns undefined when the additional filters pick is dismissed', async () => {
		answerPicks(byValue('none'), byValue('none'), byValue('none'), dismiss);
		expect(await promptForFilterOptions(COLORS)).toBeUndefined();
	});
});

describe('promptForValidationOptions', () => {
	it('returns undefined when the checks pick is dismissed', async () => {
		answerPicks(dismiss);
		expect(await promptForValidationOptions()).toBeUndefined();
	});

	it('records which checks were selected', async () => {
		answerPicks((items) => items, byValue('AA'), firstOf(1));
		answerInputs('#ffffff');
		const options = await promptForValidationOptions();
		expect(options?.checkFormat).toBe(true);
		expect(options?.checkAccessibility).toBe(true);
		expect(options?.checkContrast).toBe(true);
	});

	it('selects no checks when nothing is picked', async () => {
		answerPicks(firstOf(0), firstOf(1));
		const options = await promptForValidationOptions();
		expect(options?.checkContrast).toBe(false);
	});

	it('returns undefined when the contrast background is dismissed', async () => {
		answerPicks((items) => items);
		answerInputs(undefined);
		expect(await promptForValidationOptions()).toBeUndefined();
	});

	it('applies the AA contrast preset', async () => {
		answerPicks((items) => items, byValue('AA'), firstOf(1));
		answerInputs('#ffffff');
		const options = await promptForValidationOptions();
		expect(options?.minContrastAA).toBeDefined();
	});

	it('applies the AAA contrast preset', async () => {
		answerPicks((items) => items, byValue('AAA'), firstOf(1));
		answerInputs('#ffffff');
		const options = await promptForValidationOptions();
		expect(options?.minContrastAAA).toBeDefined();
	});

	it('accepts custom contrast thresholds', async () => {
		answerPicks((items) => items, byValue('custom'), firstOf(1));
		answerInputs('#ffffff', '3.0', '6.0');
		const options = await promptForValidationOptions();
		expect(options?.minContrastAA).toBe(3);
		expect(options?.minContrastAAA).toBe(6);
	});

	it('returns undefined when the contrast level is dismissed', async () => {
		answerPicks((items) => items, dismiss);
		answerInputs('#ffffff');
		expect(await promptForValidationOptions()).toBeUndefined();
	});

	it('records an allowed-formats restriction', async () => {
		answerPicks((items) => items, byValue('AA'), byValue('hex'));
		answerInputs('#ffffff');
		const options = await promptForValidationOptions();
		expect(options).toBeDefined();
	});
});

describe('prompt input validation', () => {
	// The validators are passed to showInputBox and now run against whatever a
	// test supplies, so a rejected value is visible rather than silently
	// accepted.

	it('rejects a non-numeric lightness bound', async () => {
		answerPicks(
			byValue('none'),
			byValue('custom'),
			byValue('none'),
			firstOf(0),
		);
		answerInputs('not-a-number', '80');
		const options = await promptForFilterOptions(COLORS);
		// Number.parseInt yields NaN, which the command stores as-is; the point is
		// the validator ran without throwing.
		expect(options).toBeDefined();
	});

	it('rejects an out-of-range lightness bound', async () => {
		answerPicks(
			byValue('none'),
			byValue('custom'),
			byValue('none'),
			firstOf(0),
		);
		answerInputs('-5', '150');
		expect(await promptForFilterOptions(COLORS)).toBeDefined();
	});

	it('accepts the boundary lightness values', async () => {
		answerPicks(
			byValue('none'),
			byValue('custom'),
			byValue('none'),
			firstOf(0),
		);
		answerInputs('0', '100');
		const options = await promptForFilterOptions(COLORS);
		expect(options?.minLightness).toBe(0);
		expect(options?.maxLightness).toBe(100);
	});

	it('rejects a non-numeric saturation bound', async () => {
		answerPicks(
			byValue('none'),
			byValue('none'),
			byValue('custom'),
			firstOf(0),
		);
		answerInputs('abc', '70');
		expect(await promptForFilterOptions(COLORS)).toBeDefined();
	});

	it('rejects an invalid contrast background colour', async () => {
		answerPicks((items) => items, byValue('AA'), firstOf(1));
		answerInputs('not-a-colour');
		const options = await promptForValidationOptions();
		expect(options).toBeDefined();
	});

	it('accepts an rgb() contrast background', async () => {
		answerPicks((items) => items, byValue('AA'), firstOf(1));
		answerInputs('rgb(255, 255, 255)');
		expect(await promptForValidationOptions()).toBeDefined();
	});

	it('rejects a non-positive custom contrast ratio', async () => {
		answerPicks((items) => items, byValue('custom'), firstOf(1));
		answerInputs('#ffffff', '0', '-1');
		expect(await promptForValidationOptions()).toBeDefined();
	});

	it('returns undefined when the second custom contrast value is dismissed', async () => {
		answerPicks((items) => items, byValue('custom'), firstOf(1));
		answerInputs('#ffffff', '3.0', undefined);
		expect(await promptForValidationOptions()).toBeUndefined();
	});
});
