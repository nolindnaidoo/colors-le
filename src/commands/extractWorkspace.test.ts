import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	_clipboardText,
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
	_respondToOpenDialog,
	_setConfig,
	_setWorkspaceFiles,
	_shownMessages,
	Uri,
	workspace,
} from '../__mocks__/vscode';
import { createTelemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import { createStatusBar } from '../ui/statusBar';
import {
	registerExtractWorkspaceCommands,
	sameColorKey,
} from './extractWorkspace';

const TREE = {
	'/w/styles/a.css':
		'a { color: #f00; background: #FF0000; }\nb { color: red; border-color: #00ff00; }\n',
	'/w/styles/b.css': 'c { color: rgb(255, 0, 0); outline-color: #00ff00; }\n',
	'/w/theme.json': '{\n  "accent": "#0000ff"\n}\n',
	'/w/node_modules/x.css': 'd { color: #123456; }\n',
	'/w/logo.png': '#abcdef',
};

async function runCommand(id: string, ...args: unknown[]): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler(...args);
}

function report(): string {
	const last = _openedDocuments().at(-1);
	if (!last) throw new Error('no report was opened');
	return last.getText();
}

function open(files: Record<string, string> = TREE): void {
	_setWorkspaceFiles(files);
	workspace.workspaceFolders = [{ uri: Uri.file('/w'), name: 'w', index: 0 }];
}

beforeEach(() => {
	_resetMockState();
	const context = { subscriptions: [] as Array<{ dispose(): void }> } as never;
	registerExtractWorkspaceCommands(context, {
		telemetry: createTelemetry(),
		notifier: createNotifier(),
		statusBar: createStatusBar(context),
	});
});

describe('the same color, however it is spelled', () => {
	it('is one key for hex in either case and length, a name, and rgb()', () => {
		const red = sameColorKey('#ff0000');
		for (const spelling of [
			'#F00',
			'#FF0000',
			'red',
			'RED',
			'rgb(255, 0, 0)',
			' #f00 ',
		])
			expect(sameColorKey(spelling), spelling).toBe(red);
		expect(sameColorKey('#00ff00')).not.toBe(red);
	});

	it('keeps alpha apart, since a see-through red is another color', () => {
		expect(sameColorKey('rgba(255, 0, 0, 0.5)')).not.toBe(
			sameColorKey('#ff0000'),
		);
	});

	it('compares what it cannot read as written, so it still groups with itself', () => {
		expect(sameColorKey('var(--Brand)')).toBe(sameColorKey('VAR(--brand)'));
		expect(sameColorKey('var(--brand)')).not.toBe(
			sameColorKey('var(--accent)'),
		);
	});
});

describe('colors-le.extractWorkspace and colors-le.extractFolder', () => {
	it('warns when no workspace is open', async () => {
		_setConfig('colors-le.notificationsLevel', 'all');
		await runCommand('colors-le.extractWorkspace');
		expect(_shownMessages()[0]).toMatchObject({ kind: 'warning' });
		expect(_openedDocuments()).toHaveLength(0);
	});

	it('lists each color once across its spellings, the most widely used first', async () => {
		_setConfig('colors-le.notificationsLevel', 'all');
		open();
		await runCommand('colors-le.extractWorkspace');

		const text = report();
		expect(text).toContain(
			'3 file(s) read · 3 distinct color(s), 7 occurrence(s) in 3 file(s)',
		);
		expect(text.split('\n').filter((line) => line.startsWith('| `'))).toEqual([
			'| `#ff0000` | `#FF0000`, `#f00`, `red`, `rgb(255, 0, 0)` | 4 | 2 |',
			'| `#00ff00` | `#00ff00` | 2 | 2 |',
			'| `#0000ff` | `#0000ff` | 1 | 1 |',
		]);
		// Positions are off by default here: a file, and how many times.
		expect(text).toContain('- `/w/styles/a.css` (3)\n- `/w/styles/b.css`');
		expect(text).not.toMatch(/\*\*\d+:\d+\*\*/);
		// Left out by the built-in list, and a .png is never opened.
		expect(text).not.toContain('#123456');
		expect(text).not.toContain('#abcdef');
		expect(_shownMessages().at(-1)?.message).toBe(
			'3 distinct color(s), 7 occurrence(s) in 3 file(s)',
		);
	});

	it('places every occurrence when positions are on, and decides the copy separately', async () => {
		open();
		_setConfig('colors-le.showPositions', true);
		_setConfig('colors-le.copyToClipboardEnabled', true);
		await runCommand('colors-le.extractWorkspace');

		expect(report()).toContain(
			'- `/w/styles/a.css` · **1:12**, **1:30**, **2:12**\n- `/w/styles/b.css` · **1:12**',
		);
		// The clipboard has its own setting, and that one is still off.
		expect(_clipboardText()).toContain('- `/w/styles/a.css` (3)');
		expect(_clipboardText()).not.toMatch(/\*\*\d+:\d+\*\*/);
	});

	it('scans only the folder it is handed, and names files relative to it', async () => {
		open();
		await runCommand('colors-le.extractFolder', Uri.file('/w/styles'));

		expect(report()).toContain(
			'`/w/styles` · 2 file(s) read · 2 distinct color(s), 6 occurrence(s) in 2 file(s)',
		);
		expect(report()).toContain('- `a.css` (3)\n- `b.css`');
	});

	it('asks for a folder from the palette, and does nothing when none is picked', async () => {
		open();
		_respondToOpenDialog(() => undefined);
		await runCommand('colors-le.extractFolder');
		expect(_openedDocuments()).toHaveLength(0);

		_respondToOpenDialog(() => [Uri.file('/w/styles')]);
		await runCommand('colors-le.extractFolder');
		expect(report()).toContain('`/w/styles` · 2 file(s) read');
	});

	it('stops at the results limit and says the rest was not read', async () => {
		open();
		_setConfig('colors-le.workspace.scanMaxResults', 1);
		await runCommand('colors-le.extractWorkspace');

		expect(report()).toContain(
			'1 distinct color(s), 1 occurrence(s) in 1 file(s)',
		);
		expect(report()).toContain(
			'> The results limit was reached. The rest of the files were not read.',
		);
	});

	it('says when a folder holds no colors', async () => {
		open({ '/w/a.txt': 'nothing here\n' });
		await runCommand('colors-le.extractWorkspace');
		expect(report()).toContain('No colors found.');
	});

	it('prints the report the README shows as its sample', async () => {
		open();
		_setConfig('colors-le.showPositions', true);
		await runCommand('colors-le.extractFolder', Uri.file('/w'));

		const readme = readFileSync(
			join(__dirname, '..', '..', 'README.md'),
			'utf8',
		);
		const shown = report()
			.split('\n')
			.filter(
				(line) =>
					line.startsWith('- ') ||
					line.startsWith('| `') ||
					line.startsWith('## '),
			);
		expect(shown).toHaveLength(11);
		for (const line of shown) expect(readme).toContain(line);
		expect(readme).toContain(
			'3 file(s) read · 3 distinct color(s), 7 occurrence(s) in 3 file(s)',
		);
	});
});
