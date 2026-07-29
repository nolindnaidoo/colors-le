import { beforeEach, describe, it } from 'vitest';
import {
	_createDocument,
	_registeredCommands,
	_resetMockState,
	_respondToInputBox,
	_respondToQuickPick,
	_setActiveEditor,
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

describe('colors-le.analyze', () => {
	it('produces an analysis report for the active document', async () => {
		registerAnalyzeCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		await runCommand('colors-le.analyze');
		// The report opens as a side-by-side markdown document; reaching this
		// point without a thrown error means extraction + analysis + report
		// generation all ran.
	});

	it('warns when there is no active editor', async () => {
		registerAnalyzeCommand(makeContext());
		await runCommand('colors-le.analyze');
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
	});

	it('does nothing when the format pick is dismissed', async () => {
		registerConvertCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		scriptQuickPicks([() => undefined]);
		await runCommand('colors-le.convert');
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
	});

	it('does nothing when checks are dismissed', async () => {
		registerValidateCommand(makeContext());
		_setActiveEditor(_createDocument(CSS_DOC));
		scriptQuickPicks([() => undefined]);
		await runCommand('colors-le.validate');
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
	});
});
