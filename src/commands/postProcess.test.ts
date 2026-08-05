import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_registeredCommands,
	_resetMockState,
	_respondToQuickPick,
	_setActiveEditor,
	_setApplyEditResult,
	_setConfig,
	_shownMessages,
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
 * Dedupe and sort both branch on whether the document is a bare colour list or
 * a source file to pull colours out of, and only the source-file arm was
 * exercised. The analysis report is built section by section behind
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
	return { telemetry, notifier: createNotifier(), statusBar };
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

	it('falls back to filtering when the document is source', async () => {
		registerDedupeCommand(makeContext(), makeDeps());
		_setActiveEditor(
			_createDocument({ content: 'a { color: #ff0000; }\np { top: 0; }\n' }),
		);
		await runCommand('colors-le.postProcess.dedupe');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('warns without an active editor', async () => {
		registerDedupeCommand(makeContext(), makeDeps());
		await runCommand('colors-le.postProcess.dedupe');
		expect(_shownMessages()[0]?.kind).not.toBe('info');
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

	it('falls back to filtering when the document is source', async () => {
		registerSortCommand(makeContext(), makeDeps());
		_setActiveEditor(
			_createDocument({
				content: 'a { color: #ff0000; }\nb { color: #00ff00; }\n',
			}),
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
	it('registers every declared command', () => {
		const context = makeContext() as unknown as {
			subscriptions: Array<{ dispose(): void }>;
		};
		activate(context as never);

		const declared = [
			'colors-le.extractColors',
			'colors-le.analyze',
			'colors-le.convert',
			'colors-le.filter',
			'colors-le.validate',
			'colors-le.postProcess.dedupe',
			'colors-le.postProcess.sort',
			'colors-le.openSettings',
			'colors-le.help',
		];
		for (const command of declared) {
			expect(_registeredCommands().has(command)).toBe(true);
		}
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
