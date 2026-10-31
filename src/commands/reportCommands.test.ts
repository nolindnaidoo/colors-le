import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
	_respondToInputBox,
	_respondToQuickPick,
	_setActiveEditor,
	_setConfig,
	_shownMessages,
} from '../__mocks__/vscode';
import { registerAnalyzeCommand } from './analyze';
import { registerConvertCommand } from './convert';
import { registerFilterCommand } from './filter';
import { registerValidateCommand } from './validate';

function makeContext() {
	return { subscriptions: [] as Array<{ dispose(): void }> } as never;
}

async function runCommand(id: string): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler();
}

/** Answer successive quick picks from a queue of chooser functions. */
function scriptQuickPicks(
	choosers: Array<(items: unknown[]) => unknown>,
): void {
	_respondToQuickPick((items) => {
		const next = choosers.shift();
		return next ? next(items) : undefined;
	});
}

const byValue =
	(value: unknown) =>
	(items: unknown[]): unknown =>
		(items as Array<{ value?: unknown }>).find((i) => i.value === value);

const allItems = (items: unknown[]): unknown => items;

const CSS_DOC = {
	content: [
		'a { color: #ff0000; }',
		'b { color: rgb(0, 255, 0); }',
		'c { color: hsl(240, 100%, 50%); }',
		'd { color: rgba(1, 2, 3, 0.5); }',
		'e { color: #ff0000; }',
	].join('\n'),
	languageId: 'css',
};

beforeEach(() => {
	_resetMockState();
});

/** The markdown report the command opened beside the editor. */
function report(): string {
	const opened = _openedDocuments();
	expect(opened).toHaveLength(1);
	expect(opened[0]?.languageId).toBe('markdown');
	return opened[0]?.getText() ?? '';
}

// Every test here used to end without an assertion, so a command that opened
// nothing, or a report with the wrong numbers in it, passed. Each reads the
// report back now.

describe('colors-le.analyze', () => {
	it('produces an analysis report for the active document', async () => {
		registerAnalyzeCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		await runCommand('colors-le.analyze');
		const text = report();
		expect(text).toContain('# Color Analysis Report');
		expect(text).toContain('- **Total Colors**: 5');
		expect(text).toContain('- **Unique Colors**: 4');
		expect(text).toContain('| HEX | 2 | 40.0% |');
		expect(text).toContain('| `#ff0000` | 2 | 40.0% |');
	});

	it('warns when there is no active editor', async () => {
		_setConfig('colors-le.notificationsLevel', 'important');
		registerAnalyzeCommand(makeContext());
		await runCommand('colors-le.analyze');
		expect(_shownMessages().map((m) => [m.kind, m.message])).toEqual([
			['warning', 'No active editor found'],
		]);
		expect(_openedDocuments()).toHaveLength(0);
	});
});

describe('colors-le.convert', () => {
	it('converts to rgb with scripted options', async () => {
		registerConvertCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		scriptQuickPicks([
			byValue('rgb'), // target format
			byValue(true), // preserve alpha
			byValue(true), // round values
		]);
		await runCommand('colors-le.convert');
		const text = report();
		expect(text).toContain('**Target Format**: RGB');
		expect(text).toContain('| `#ff0000` | `rgb(255, 0, 0)` | HEX → RGB |');
		expect(text).toContain(
			'| `hsl(240, 100%, 50%)` | `rgb(0, 0, 255)` | HSL → RGB |',
		);
		expect(text).toContain('- **Successful**: 5');
	});

	it('converts to hex incl. case/short-hex options', async () => {
		registerConvertCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		scriptQuickPicks([
			byValue('hex'),
			byValue(true), // preserve alpha
			byValue(true), // round
			byValue(false), // lowercase
			byValue(false), // full hex
		]);
		await runCommand('colors-le.convert');
		const text = report();
		expect(text).toContain('| `rgb(0, 255, 0)` | `#00ff00` | RGB → HEX |');
		expect(text).toContain(
			'| `rgba(1, 2, 3, 0.5)` | `#01020380` | RGBA → HEX |',
		);
		expect(text).toContain('- **Uppercase**: No');
		expect(text).toContain('- **Short Hex**: No');
	});

	it('does nothing when the format pick is dismissed', async () => {
		registerConvertCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		scriptQuickPicks([() => undefined]);
		await runCommand('colors-le.convert');
		expect(_openedDocuments()).toHaveLength(0);
	});
});

describe('colors-le.filter', () => {
	it('filters with lightness and saturation criteria', async () => {
		registerFilterCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		scriptQuickPicks([
			byValue('none'), // no format filtering
			byValue('dark'), // dark colors only
			byValue('vibrant'), // vibrant only
			() => [], // no additional filters
		]);
		await runCommand('colors-le.filter');
		const text = report();
		expect(text).toContain('- **Max Lightness**: 30%');
		expect(text).toContain('- **Min Saturation**: 70%');
		expect(text).toContain('- **Kept**: 0');
		expect(text).toContain('- **Excluded**: 5');
		// rgba(1, 2, 3, 0.5) is dark enough and half saturated; the rest are
		// at 50% lightness.
		expect(text).toContain('| too light | 4 | 80.0% |');
		expect(text).toContain('| too muted | 1 | 20.0% |');
	});

	it('supports include-format selection', async () => {
		registerFilterCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		scriptQuickPicks([
			byValue('include'),
			allItems, // include every available format
			byValue('none'), // no lightness filter
			byValue('none'), // no saturation filter
			() => [],
		]);
		await runCommand('colors-le.filter');
		const text = report();
		expect(text).toContain('- **Include Formats**: HEX, HSL, RGB, RGBA');
		expect(text).toContain('- **Kept**: 5');
		expect(text).toContain('- **Excluded**: 0');
	});
});

describe('colors-le.validate', () => {
	it('runs all checks against a white background', async () => {
		registerValidateCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		_respondToInputBox(() => '#ffffff');
		scriptQuickPicks([
			allItems, // every basic check incl. contrast
			byValue('AA'), // WCAG AA
			byValue('all'), // allow all formats
		]);
		await runCommand('colors-le.validate');
		const text = report();
		expect(text).toContain('- **Total Colors**: 5');
		expect(text).toContain('  - Background: `#ffffff`');
		expect(text).toContain('  - WCAG AA: 4.5:1');
		// Red on white is 4.0:1.
		expect(text).toContain(
			'Contrast ratio 4.00:1 fails WCAG AA (minimum 4.5:1)',
		);
		// The near-black is 20.8:1, so it carries a level and no contrast issue;
		// blue has no issue at all and is counted among the valid.
		expect(text).toContain(
			'### 🟡 `rgba(1, 2, 3, 0.5)`\n\n**Contrast Ratio**: 20.77:1\n**Accessibility Level**: AA',
		);
		expect(text).toContain('- **Warnings**: 4');
		expect(text).toContain('✅ **1 colors passed all validation checks**');
	});

	it('does nothing when checks are dismissed', async () => {
		registerValidateCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		scriptQuickPicks([() => undefined]);
		await runCommand('colors-le.validate');
		expect(_openedDocuments()).toHaveLength(0);
	});
});

describe('additional option paths', () => {
	it('convert: hsl target with alpha dropped', async () => {
		registerConvertCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		scriptQuickPicks([
			byValue('hsl'),
			byValue(false), // drop alpha
			byValue(false), // keep decimals
		]);
		await runCommand('colors-le.convert');
		const text = report();
		expect(text).toContain('**Target Format**: HSL');
		expect(text).toContain('- **Preserve Alpha**: No');
		expect(text).toContain('| `#ff0000` | `hsl(0, 100%, 50%)` | HEX → HSL |');
		expect(text).toContain(
			'| `rgba(1, 2, 3, 0.5)` | `hsl(210, 50%, 1%)` | RGBA → HSL |',
		);
	});

	it('filter: exclude formats with custom lightness range', async () => {
		registerFilterCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		_respondToInputBox(() => '20');
		scriptQuickPicks([
			byValue('exclude'),
			(items) => [items[0]], // exclude the first available format
			byValue('custom'), // custom lightness range (uses input box)
			byValue('muted'), // muted colors only
			() => [], // no additional filters
		]);
		await runCommand('colors-le.filter');
		const text = report();
		expect(text).toContain('- **Exclude Formats**: HEX');
		expect(text).toContain('- **Min Lightness**: 20%');
		expect(text).toContain('- **Max Lightness**: 20%');
		expect(text).toContain('- **Max Saturation**: 30%');
		expect(text).toContain('- **Kept**: 0');
	});

	it('validate: hex-only restriction flags non-hex colors', async () => {
		registerValidateCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		scriptQuickPicks([
			(items) =>
				(items as Array<{ label: string }>).filter(
					(i) => i.label === 'Format validation',
				),
			byValue('hex'),
		]);
		await runCommand('colors-le.validate');
		const text = report();
		expect(text).toContain('- **Allowed Formats**: HEX');
		expect(text).toContain('Format RGB not in allowed formats');
		expect(text).toContain('Format HSL not in allowed formats');
		expect(text).toContain('Format RGBA not in allowed formats');
		expect(text).toContain('| 🟡 format | warning | 3 |');
	});
});

describe('the report commands obey notificationsLevel', () => {
	// Each of the four was wrapped in `guarded(createNotifier(), …)` and then
	// called `vscode.window.show*Message` itself, so the level governed the
	// guard's own failure toast and nothing the command said: the "No active
	// editor" warning and the completion summary showed at `silent`.
	const commands = [
		{
			id: 'colors-le.analyze',
			register: () => registerAnalyzeCommand(makeContext()),
			picks: [],
			summary: /^Color analysis completed/,
		},
		{
			id: 'colors-le.convert',
			register: () => registerConvertCommand(makeContext()),
			picks: [byValue('rgb'), byValue(true), byValue(true)],
			summary: /^Color conversion completed/,
		},
		{
			id: 'colors-le.filter',
			register: () => registerFilterCommand(makeContext()),
			picks: [byValue('none'), byValue('none'), byValue('none'), () => []],
			summary: /^Color filtering completed/,
		},
		{
			id: 'colors-le.validate',
			register: () => registerValidateCommand(makeContext()),
			picks: [allItems, byValue('AA'), byValue('all')],
			summary: /^Color validation completed/,
		},
	];

	for (const command of commands) {
		it(`${command.id}: says nothing at silent, and the summary at all`, async () => {
			command.register();
			await runCommand(command.id);
			expect(_shownMessages()).toEqual([]);

			_setActiveEditor(_createDocument(CSS_DOC));
			_respondToInputBox(() => '#ffffff');
			scriptQuickPicks([...command.picks]);
			await runCommand(command.id);
			expect(_shownMessages()).toEqual([]);

			_setConfig('colors-le.notificationsLevel', 'all');
			_respondToInputBox(() => '#ffffff');
			scriptQuickPicks([...command.picks]);
			await runCommand(command.id);
			expect(_shownMessages().map((m) => m.kind)).toEqual(['info']);
			expect(_shownMessages()[0]?.message).toMatch(command.summary);
		});
	}
});
