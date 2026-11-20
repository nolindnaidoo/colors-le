import { beforeEach, describe, expect, it } from 'vitest';
import {
	_inputBoxRejections,
	_resetMockState,
	_respondToInputBox,
	_respondToQuickPick,
} from '../__mocks__/vscode';
import type { Color } from '../types';
import { filterColors } from './filter';
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
	// VS Code will not hand a command a value its own validator rejected — the
	// box stays open until the input is valid or the user escapes. So a rejected
	// value aborts the prompt, and the command never sees it.

	it('refuses a non-numeric lightness bound', async () => {
		answerPicks(byValue('none'), byValue('custom'));
		answerInputs('not-a-number');
		expect(await promptForFilterOptions(COLORS)).toBeUndefined();
		expect(_inputBoxRejections()[0]?.value).toBe('not-a-number');
	});

	it('refuses an out-of-range lightness bound', async () => {
		answerPicks(byValue('none'), byValue('custom'));
		answerInputs('150');
		expect(await promptForFilterOptions(COLORS)).toBeUndefined();
		expect(_inputBoxRejections()).toHaveLength(1);
	});

	it('refuses a negative lightness bound', async () => {
		answerPicks(byValue('none'), byValue('custom'));
		answerInputs('-5');
		expect(await promptForFilterOptions(COLORS)).toBeUndefined();
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

	it('refuses a non-numeric saturation bound', async () => {
		answerPicks(byValue('none'), byValue('none'), byValue('custom'));
		answerInputs('abc');
		expect(await promptForFilterOptions(COLORS)).toBeUndefined();
		expect(_inputBoxRejections()[0]?.value).toBe('abc');
	});

	it('refuses an invalid contrast background colour', async () => {
		answerPicks((items) => items);
		answerInputs('not-a-colour');
		expect(await promptForValidationOptions()).toBeUndefined();
		expect(_inputBoxRejections()[0]?.value).toBe('not-a-colour');
	});

	it('accepts an rgb() contrast background', async () => {
		answerPicks((items) => items, byValue('AA'), firstOf(1));
		answerInputs('rgb(255, 255, 255)');
		expect(await promptForValidationOptions()).toBeDefined();
	});

	it('refuses a non-positive custom contrast ratio', async () => {
		answerPicks((items) => items, byValue('custom'));
		answerInputs('#ffffff', '0');
		expect(await promptForValidationOptions()).toBeUndefined();
		expect(_inputBoxRejections()[0]?.value).toBe('0');
	});

	it('accepts a valid value without recording a rejection', async () => {
		answerPicks((items) => items, byValue('AA'), firstOf(1));
		answerInputs('#ffffff');
		expect(await promptForValidationOptions()).toBeDefined();
		expect(_inputBoxRejections()).toHaveLength(0);
	});

	it('returns undefined when the second custom contrast value is dismissed', async () => {
		answerPicks((items) => items, byValue('custom'), firstOf(1));
		answerInputs('#ffffff', '3.0', undefined);
		expect(await promptForValidationOptions()).toBeUndefined();
	});
});

describe('the filter presets keep what their labels say', () => {
	// Lightness and saturation are whole percentages, so a strict bound in a
	// label is the next whole number in the options.
	const AT_30_AND_70 = [
		color('#4d4d4d'),
		color('#b3b3b3'),
		color('hsl(0, 30%, 50%)', 'hsl'),
		color('hsl(0, 70%, 50%)', 'hsl'),
	];

	async function kept(lightness: string, saturation: string) {
		answerPicks(
			byValue('none'),
			byValue(lightness),
			byValue(saturation),
			firstOf(0),
		);
		const options = await promptForFilterOptions(AT_30_AND_70);
		if (options === undefined) throw new Error('the prompts were dismissed');
		return filterColors(AT_30_AND_70, options).filtered.map((c) => c.value);
	}

	it('"Lightness < 30%" drops a colour at 30%', async () => {
		expect(await kept('dark', 'none')).toEqual([]);
	});

	it('"Lightness > 70%" drops a colour at 70%', async () => {
		expect(await kept('light', 'none')).toEqual([]);
	});

	it('"30% ≤ Lightness ≤ 70%" keeps both ends', async () => {
		expect(await kept('medium', 'none')).toEqual([
			'#4d4d4d',
			'#b3b3b3',
			'hsl(0, 30%, 50%)',
			'hsl(0, 70%, 50%)',
		]);
	});

	it('"Saturation > 70%" and "Saturation < 30%" drop a colour at the bound', async () => {
		expect(await kept('none', 'vibrant')).toEqual([]);
		expect(await kept('none', 'muted')).toEqual(['#4d4d4d', '#b3b3b3']);
	});
});
