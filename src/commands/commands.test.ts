import { beforeEach, describe, expect, it } from 'vitest';
import {
	_clipboardText,
	_createDocument,
	_registeredCommands,
	_resetMockState,
	_setActiveEditor,
	_setConfig,
	_shownMessages,
	appliedEdits,
} from '../__mocks__/vscode';
import type { Telemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { registerDedupeCommand } from './dedupe';
import { registerExtractCommand } from './extract';
import { registerSortCommand } from './sort';

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
});

describe('colors-le.postProcess.dedupe', () => {
	it('warns when no editor is active', async () => {
		_setConfig('colors-le.notificationsLevel', 'important');
		registerDedupeCommand(makeContext(), makeDeps());
		await runCommand('colors-le.postProcess.dedupe');
		expect(_shownMessages()[0]?.kind).toBe('warning');
		expect(appliedEdits).toHaveLength(0);
	});

	it('removes duplicates and reports an honest count', async () => {
		_setConfig('colors-le.notificationsLevel', 'all');
		registerDedupeCommand(makeContext(), makeDeps());
		_setActiveEditor(
			_createDocument({ content: '#aabbcc\n#ddeeff\n#aabbcc\n' }),
		);
		await runCommand('colors-le.postProcess.dedupe');

		expect(appliedEdits).toHaveLength(1);
		expect(appliedEdits[0]?.replacements[0]?.newText).toBe('#aabbcc\n#ddeeff');
		expect(_shownMessages()[0]?.message).toBe(
			'Removed 1 duplicate colors (2 remaining)',
		);
	});

	it('suppresses the success toast at the default silent level', async () => {
		registerDedupeCommand(makeContext(), makeDeps());
		_setActiveEditor(_createDocument({ content: '#aabbcc\n#aabbcc' }));
		await runCommand('colors-le.postProcess.dedupe');

		expect(appliedEdits).toHaveLength(1); // the edit still happens
		expect(_shownMessages()).toHaveLength(0); // the toast does not
	});
});

describe('colors-le.postProcess.sort', () => {
	it('sorts by the configured mode', async () => {
		_setConfig('colors-le.notificationsLevel', 'all');
		_setConfig('colors-le.sortMode', 'hex-asc');
		registerSortCommand(makeContext(), makeDeps());
		_setActiveEditor(_createDocument({ content: '#ddeeff\n#aabbcc\n#ccddee' }));
		await runCommand('colors-le.postProcess.sort');

		expect(appliedEdits[0]?.replacements[0]?.newText).toBe(
			'#aabbcc\n#ccddee\n#ddeeff',
		);
		expect(_shownMessages()[0]?.message).toBe('Sorted 3 colors by hex-asc');
	});

	it('warns when no editor is active', async () => {
		_setConfig('colors-le.notificationsLevel', 'important');
		registerSortCommand(makeContext(), makeDeps());
		await runCommand('colors-le.postProcess.sort');
		expect(_shownMessages()[0]?.kind).toBe('warning');
	});
});

describe('colors-le.extractColors', () => {
	it('extracts side-by-side and copies when configured', async () => {
		const events: string[] = [];
		registerExtractCommand(makeContext(), makeDeps(events));
		_setConfig('colors-le.notificationsLevel', 'all');
		_setConfig('colors-le.copyToClipboardEnabled', true);
		_setActiveEditor(
			_createDocument({
				content: 'a { color: #ff0000; background: #00ff00; }',
				languageId: 'css',
			}),
		);

		await runCommand('colors-le.extractColors');

		expect(events).toContain('command-extract-colors');
		expect(events).toContain('extract-success');
		expect(_clipboardText()).toBe('#ff0000\n#00ff00');
		expect(
			_shownMessages().some((m) =>
				m.message.includes('Extracted 2 colors and copied to clipboard'),
			),
		).toBe(true);
	});

	it('dedupes output when dedupeEnabled is set', async () => {
		registerExtractCommand(makeContext(), makeDeps());
		_setConfig('colors-le.copyToClipboardEnabled', true);
		_setConfig('colors-le.dedupeEnabled', true);
		_setActiveEditor(
			_createDocument({
				content: 'a { color: #ff0000; } b { color: #ff0000; }',
				languageId: 'css',
			}),
		);

		await runCommand('colors-le.extractColors');
		expect(_clipboardText()).toBe('#ff0000');
	});

	it('shows an error when no editor is active', async () => {
		registerExtractCommand(makeContext(), makeDeps());
		await runCommand('colors-le.extractColors');
		expect(_shownMessages()[0]?.kind).toBe('error');
	});

	it('reports empty documents as info, not error', async () => {
		_setConfig('colors-le.notificationsLevel', 'all');
		registerExtractCommand(makeContext(), makeDeps());
		_setActiveEditor(
			_createDocument({ content: 'p { margin: 0; }', languageId: 'css' }),
		);
		await runCommand('colors-le.extractColors');
		expect(
			_shownMessages().some((m) => m.message.includes('No colors found')),
		).toBe(true);
		expect(_shownMessages().every((m) => m.kind !== 'error')).toBe(true);
	});
});

describe('colors-le.help', () => {
	it('opens the help document and logs telemetry', async () => {
		const events: string[] = [];
		const { registerHelpCommand } = await import('./help');
		registerHelpCommand(makeContext(), makeDeps(events));
		await runCommand('colors-le.help');
		expect(events).toContain('command-help');
	});
});

describe('colors-le.extractColors edge paths', () => {
	it('replaces in place when side-by-side is disabled', async () => {
		registerExtractCommand(makeContext(), makeDeps());
		_setConfig('colors-le.openResultsSideBySide', false);
		_setActiveEditor(
			_createDocument({ content: 'a { color: #123456; }', languageId: 'css' }),
		);
		await runCommand('colors-le.extractColors');
		expect(appliedEdits).toHaveLength(1);
		expect(appliedEdits[0]?.replacements[0]?.newText).toBe('#123456');
	});

	it('blocks oversized documents when safety says no', async () => {
		registerExtractCommand(makeContext(), makeDeps());
		_setConfig('colors-le.notificationsLevel', 'important');
		_setConfig('colors-le.safety.fileSizeWarnBytes', 1000);
		_setActiveEditor(
			_createDocument({
				content: `a { color: #fff; } ${'x'.repeat(2000)}`,
				languageId: 'css',
			}),
		);
		await runCommand('colors-le.extractColors');
		expect(appliedEdits).toHaveLength(0);
		expect(_shownMessages()[0]?.kind).toBe('warning');
	});
});
