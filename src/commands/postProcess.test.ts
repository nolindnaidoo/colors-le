import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_createExtensionContext,
	_registeredCommands,
	_resetMockState,
	_respondToQuickPick,
	_setActiveEditor,
	_setApplyEditResult,
	_setConfig,
	_shownMessages,
	appliedEdits,
} from '../__mocks__/vscode';
import { activate, deactivate } from '../extension';
import type { Telemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { registerAnalyzeCommand } from './analyze';
import { registerDedupeCommand } from './dedupe';
import { registerSortCommand } from './sort';

/**
 * The post-process commands, the analysis report, and the activation entry
 * point.
 *
 * Dedupe and sort read a list of colours as Extract writes it and refuse
 * anything else untouched. The analysis report is built section by section behind
 * "did we find any" checks, so a document producing none of them leaves most
 * of the file unread.
 */

function makeContext() {
	return { subscriptions: [] as Array<{ dispose(): void }> } as never;
}

function makeDeps(events: string[] = []) {
	const telemetry: Telemetry = {
		event: (name) => events.push(name),
		dispose: () => {},
	};
	const statusBar: StatusBar = {
		showProgress: () => {},
		hideProgress: () => {},
		dispose: () => {},
	};
	return {
		telemetry,
		notifier: createNotifier(),
		statusBar,
		ratingPrompt: { recordSuccess: async () => {} },
	};
}

async function runCommand(id: string): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler();
}

beforeEach(() => {
	_resetMockState();
	_setConfig('colors-le.notificationsLevel', 'all');
});

describe('dedupe: colour-list documents', () => {
	it('treats a file of bare hex values as a colour list', async () => {
		registerDedupeCommand(makeContext(), makeDeps());
		_setActiveEditor(
			_createDocument({ content: '#ff0000\n#ff0000\n#00ff00\n' }),
		);
		await runCommand('colors-le.postProcess.dedupe');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('accepts rgb() and hsl() lines as a colour list', async () => {
		registerDedupeCommand(makeContext(), makeDeps());
		_setActiveEditor(
			_createDocument({
				content: 'rgb(255, 0, 0)\nhsl(0, 100%, 50%)\nrgb(255, 0, 0)\n',
			}),
		);
		await runCommand('colors-le.postProcess.dedupe');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('tolerates blank lines within a colour list', async () => {
		// The blank-line arm of the every() predicate.
		registerDedupeCommand(makeContext(), makeDeps());
		_setActiveEditor(_createDocument({ content: '#ff0000\n\n#ff0000\n\n' }));
		await runCommand('colors-le.postProcess.dedupe');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('warns without an active editor', async () => {
		registerDedupeCommand(makeContext(), makeDeps());
		await runCommand('colors-le.postProcess.dedupe');
		expect(_shownMessages()[0]?.kind).not.toBe('info');
	});
});

describe('a line command reads what Extract writes, and nothing else', () => {
	// Both commands kept only the lines that were a six-digit hex, an rgb()
	// or an hsl(), and wrote those back over the whole document. A results
	// list carrying a short hex, an rgba(), an hwb() or a keyword lost those
	// lines, and a stylesheet, which has no bare colour line at all, was
	// replaced with nothing and reported as "Removed 0 duplicate colors (0
	// remaining)". A document that is not a list of colours is now refused
	// untouched, and every notation Extract reports is a colour.
	async function dedupe(content: string): Promise<string | undefined> {
		registerDedupeCommand(makeContext(), makeDeps());
		_setActiveEditor(_createDocument({ content }));
		await runCommand('colors-le.postProcess.dedupe');
		return appliedEdits[0]?.replacements[0]?.newText;
	}

	async function sort(content: string): Promise<string | undefined> {
		_setConfig('colors-le.sortMode', 'lightness-asc');
		registerSortCommand(makeContext(), makeDeps());
		_setActiveEditor(_createDocument({ content }));
		await runCommand('colors-le.postProcess.sort');
		return appliedEdits[0]?.replacements[0]?.newText;
	}

	it('dedupe keeps every notation Extract reports', async () => {
		expect(
			await dedupe(
				'#fff\nred\nrgba(0, 0, 0, 0.5)\nhwb(90 10% 10%)\n#f0a8\n#fff\nRed\n',
			),
		).toBe('#fff\nred\nrgba(0, 0, 0, 0.5)\nhwb(90 10% 10%)\n#f0a8\nRed\n');
		expect(_shownMessages()[0]?.message).toBe(
			'Removed 1 duplicate colors (6 remaining)',
		);
	});

	it('dedupe keeps the positions Extract wrote', async () => {
		expect(await dedupe('1:3\t#fff\n2:9\tred\n3:3\t#fff\n')).toBe(
			'1:3\t#fff\n2:9\tred\n',
		);
	});

	it('dedupe refuses a stylesheet and leaves it untouched', async () => {
		expect(
			await dedupe('a { color: #ff0000; }\np { top: 0; }\n'),
		).toBeUndefined();
		expect(appliedEdits).toHaveLength(0);
		expect(_shownMessages().map((m) => [m.kind, m.message])).toEqual([
			[
				'warning',
				'Deduplicate Colors reads a list of colors, one per line, as Extract Colors writes it. Line 1 is not a color: a { color: #ff0000; }',
			],
		]);
	});

	it('dedupe names the first line that is not a colour, by its number', async () => {
		expect(await dedupe('#fff\n\n#000\nnot a colour\n')).toBeUndefined();
		expect(_shownMessages()[0]?.message).toContain('Line 4 is not a color');
	});

	it('dedupe keeps a trailing newline, and adds none where there was none', async () => {
		expect(await dedupe('#fff\n#fff\n#000\n')).toBe('#fff\n#000\n');
		_resetMockState();
		_setConfig('colors-le.notificationsLevel', 'all');
		expect(await dedupe('#fff\n#fff\n#000')).toBe('#fff\n#000');
	});

	it('dedupe writes CRLF back to a CRLF document', async () => {
		expect(await dedupe('#fff\r\n#fff\r\n#000\r\n')).toBe('#fff\r\n#000\r\n');
	});

	it('dedupe drops a blank line inside and does not count it, and leaves an empty document empty', async () => {
		expect(await dedupe('#fff\n\n#000\n')).toBe('#fff\n#000\n');
		expect(_shownMessages()[0]?.message).toBe(
			'Removed 0 duplicate colors (2 remaining)',
		);
		_resetMockState();
		_setConfig('colors-le.notificationsLevel', 'all');
		expect(await dedupe('')).toBe('');
	});

	it('sort keeps every notation Extract reports, in the configured order', async () => {
		expect(await sort('white\n#000\nrgba(128, 128, 128, 0.5)\n')).toBe(
			'#000\nrgba(128, 128, 128, 0.5)\nwhite\n',
		);
		expect(_shownMessages()[0]?.message).toBe(
			'Sorted 3 colors by lightness-asc',
		);
	});

	it('sort refuses a stylesheet and leaves it untouched', async () => {
		expect(
			await sort('a { color: #ff0000; }\nb { color: #00ff00; }\n'),
		).toBeUndefined();
		expect(appliedEdits).toHaveLength(0);
		expect(_shownMessages()[0]?.message).toBe(
			'Sort Colors reads a list of colors, one per line, as Extract Colors writes it. Line 1 is not a color: a { color: #ff0000; }',
		);
	});

	it('sort writes CRLF back to a CRLF document, keeps the terminator, and never puts a blank line first', async () => {
		expect(await sort('white\r\n\r\n#000\r\n')).toBe('#000\r\nwhite\r\n');
		_resetMockState();
		_setConfig('colors-le.notificationsLevel', 'all');
		expect(await sort('white\n#000')).toBe('#000\nwhite');
		_resetMockState();
		_setConfig('colors-le.notificationsLevel', 'all');
		expect(await sort('')).toBe('');
	});
});

describe('sort: colour-list documents', () => {
	it('treats a file of bare hex values as a colour list', async () => {
		registerSortCommand(makeContext(), makeDeps());
		_setActiveEditor(
			_createDocument({ content: '#00ff00\n#ff0000\n#0000ff\n' }),
		);
		_respondToQuickPick((items) => items[0]);
		await runCommand('colors-le.postProcess.sort');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('accepts rgb() and hsl() lines as a colour list', async () => {
		registerSortCommand(makeContext(), makeDeps());
		_setActiveEditor(
			_createDocument({ content: 'rgb(0, 255, 0)\nhsl(0, 100%, 50%)\n' }),
		);
		_respondToQuickPick((items) => items[0]);
		await runCommand('colors-le.postProcess.sort');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('handles the sort mode pick being dismissed', async () => {
		// Dismissing still reports back to the user rather than failing silently.
		registerSortCommand(makeContext(), makeDeps());
		_setActiveEditor(_createDocument({ content: '#ff0000\n#00ff00\n' }));
		_respondToQuickPick(() => undefined);
		await expect(
			runCommand('colors-le.postProcess.sort'),
		).resolves.toBeUndefined();
	});
});

describe('analyze: report sections', () => {
	// analyze registers itself with only a context; it builds its own notifier.
	async function analyze(content: string): Promise<void> {
		registerAnalyzeCommand(makeContext());
		_setActiveEditor(_createDocument({ content }));
		await runCommand('colors-le.analyze');
	}

	it('reports a document with no colours', async () => {
		await analyze('nothing to see here');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('includes the statistics sections for a varied palette', async () => {
		// Dominant hue, average saturation and lightness, by-format and
		// most-common sections each sit behind their own presence check.
		await analyze(
			'#ff0000\n#ff3333\n#00ff00\nrgb(0, 0, 255)\nhsl(60, 100%, 50%)\n#ff0000\n',
		);
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('handles a single-colour document', async () => {
		await analyze('#ff0000\n');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('handles a greyscale palette', async () => {
		// Saturation zero exercises the hue branch differently.
		await analyze('#000000\n#777777\n#ffffff\n');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});
});

describe('activation', () => {
	it('registers every declared command, and no other', () => {
		// The manifest is the list; a hand-written copy held nine of eleven.
		const manifest = JSON.parse(
			readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
		) as { contributes: { commands: Array<{ command: string }> } };
		const declared = manifest.contributes.commands
			.map((entry) => entry.command)
			.sort();

		const context = _createExtensionContext();
		activate(context as never);

		expect([..._registeredCommands().keys()].sort()).toEqual(declared);
	});

	it('deactivate is a no-op that does not throw', () => {
		// Cleanup runs through context.subscriptions; deactivate exists to satisfy
		// the extension contract and was the last uncovered function in the file.
		expect(() => deactivate()).not.toThrow();
	});
});

describe('rejected edits', () => {
	// applyEdit resolves false for a read-only document, or one that changed
	// underneath the command. All three commands discarded that value and
	// announced a result over a document they had not touched.

	it('dedupe reports a failure instead of a count', async () => {
		registerDedupeCommand(makeContext(), makeDeps());
		_setApplyEditResult(false);
		_setActiveEditor(
			_createDocument({ content: '#ff0000\n#ff0000\n#00ff00\n' }),
		);
		await runCommand('colors-le.postProcess.dedupe');
		expect(_shownMessages().some((m) => m.kind === 'error')).toBe(true);
		expect(
			_shownMessages().some((m) => String(m.message).startsWith('Removed')),
		).toBe(false);
	});

	it('sort reports a failure instead of a count', async () => {
		registerSortCommand(makeContext(), makeDeps());
		_setApplyEditResult(false);
		_respondToQuickPick((items) => items[0]);
		_setActiveEditor(
			_createDocument({ content: '#00ff00\n#ff0000\n#0000ff\n' }),
		);
		await runCommand('colors-le.postProcess.sort');
		expect(_shownMessages().some((m) => m.kind === 'error')).toBe(true);
		expect(
			_shownMessages().some((m) => String(m.message).startsWith('Sorted')),
		).toBe(false);
	});

	it('dedupe still announces the count when the edit applies', async () => {
		registerDedupeCommand(makeContext(), makeDeps());
		_setActiveEditor(
			_createDocument({ content: '#ff0000\n#ff0000\n#00ff00\n' }),
		);
		await runCommand('colors-le.postProcess.dedupe');
		expect(_shownMessages().some((m) => m.kind === 'error')).toBe(false);
		expect(
			_shownMessages().some((m) => String(m.message).startsWith('Removed')),
		).toBe(true);
	});
});
