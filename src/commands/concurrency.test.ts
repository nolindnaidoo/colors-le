import { beforeEach, describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import {
	_createDocument,
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
	_respondToQuickPick,
	_setActiveEditor,
	_setConfig,
	_setWorkspaceFiles,
	_shownMessages,
	executedBuiltins,
	Uri,
	workspace,
} from '../__mocks__/vscode';
import { registerOpenSettingsCommand } from '../config/settings';
import type { Telemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { registerAnalyzeCommand } from './analyze';
import { registerConvertCommand } from './convert';
import { registerExtractWorkspaceCommands } from './extractWorkspace';
import { registerFilterCommand } from './filter';
import { registerHelpCommand } from './help';
import { registerValidateCommand } from './validate';

/**
 * RACE-3 for the commands the line-command test does not cover: a second
 * invocation is started while the first is suspended at a host call, and
 * each must reach its own result from its own input. The policy the code
 * implements is "run both independently"; nothing is shared between two runs
 * but the host's own UI.
 */

function makeContext() {
	return { subscriptions: [] as Array<{ dispose(): void }> } as never;
}

function makeDeps() {
	const telemetry: Telemetry = { event: () => {}, dispose: () => {} };
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

function handler(id: string): (...args: unknown[]) => Promise<void> {
	const found = _registeredCommands().get(id);
	if (!found) throw new Error(`command not registered: ${id}`);
	return found as (...args: unknown[]) => Promise<void>;
}

/**
 * Hold the first call to `target[method]` until `release()`, so a test can
 * start a second invocation while the first is suspended there. Later calls
 * pass straight through.
 */
function holdFirst<T extends object>(target: T, method: keyof T) {
	const original = target[method] as unknown as (...a: unknown[]) => unknown;
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	let reachedResolve!: () => void;
	const reached = new Promise<void>((resolve) => {
		reachedResolve = resolve;
	});
	let calls = 0;
	(target as Record<keyof T, unknown>)[method] = async (...args: unknown[]) => {
		calls += 1;
		if (calls === 1) {
			reachedResolve();
			await gate;
		}
		return original.apply(target, args);
	};
	return {
		reached,
		release,
		restore: () => {
			(target as Record<keyof T, unknown>)[method] = original;
		},
	};
}

const redDoc = () =>
	_createDocument({
		content: 'a { color: #ff0000; }\nb { color: #ff0000; }',
		languageId: 'css',
	});
const blueDoc = () =>
	_createDocument({
		content:
			'a { color: #0000ff; }\nb { color: #00ff00; }\nc { color: #111111; }',
		languageId: 'css',
	});

beforeEach(() => {
	_resetMockState();
	_setConfig('colors-le.notificationsLevel', 'all');
});

describe('two invocations at once: the report commands', () => {
	it('two Analyze runs, the first held at openTextDocument, each report their own document', async () => {
		registerAnalyzeCommand(makeContext());
		const hold = holdFirst(workspace, 'openTextDocument');
		try {
			_setActiveEditor(redDoc());
			const first = handler('colors-le.analyze')();
			await hold.reached;
			_setActiveEditor(blueDoc());
			await handler('colors-le.analyze')();
			hold.release();
			await first;
		} finally {
			hold.restore();
		}
		const reports = _openedDocuments().map((d) => d.getText());
		expect(reports).toHaveLength(2);
		expect(reports[0]).toContain('**Total Colors**: 3');
		expect(reports[1]).toContain('**Total Colors**: 2');
		expect(
			_shownMessages()
				.filter((m) => m.kind === 'info')
				.map((m) => m.message),
		).toEqual([
			'Color analysis completed. Found 3 colors with 3 unique values.',
			'Color analysis completed. Found 2 colors with 1 unique values.',
		]);
	});

	it('two Convert runs, the first held at its first quick pick, each convert their own document', async () => {
		registerConvertCommand(makeContext());
		// rgb, keep alpha, round
		_respondToQuickPick((items) => {
			const list = items as Array<{ value?: unknown }>;
			return list.find((i) => i.value === 'rgb') ?? list[0];
		});
		const hold = holdFirst(vscode.window, 'showQuickPick');
		try {
			_setActiveEditor(redDoc());
			const first = handler('colors-le.convert')();
			await hold.reached;
			_setActiveEditor(blueDoc());
			await handler('colors-le.convert')();
			hold.release();
			await first;
		} finally {
			hold.restore();
		}
		const reports = _openedDocuments().map((d) => d.getText());
		expect(reports).toHaveLength(2);
		expect(reports[0]).toContain('rgb(0, 0, 255)');
		expect(reports[0]).not.toContain('rgb(255, 0, 0)');
		expect(reports[1]).toContain('rgb(255, 0, 0)');
		expect(reports[1]).not.toContain('rgb(0, 0, 255)');
	});

	it('two Filter runs, the first held at its first quick pick, each filter their own document', async () => {
		registerFilterCommand(makeContext());
		_respondToQuickPick((items) => {
			const list = items as Array<{ value?: unknown; label?: string }>;
			if (list.some((i) => i.value === 'none'))
				return list.find((i) => i.value === 'none');
			return [];
		});
		const hold = holdFirst(vscode.window, 'showQuickPick');
		try {
			_setActiveEditor(redDoc());
			const first = handler('colors-le.filter')();
			await hold.reached;
			_setActiveEditor(blueDoc());
			await handler('colors-le.filter')();
			hold.release();
			await first;
		} finally {
			hold.restore();
		}
		const reports = _openedDocuments().map((d) => d.getText());
		expect(reports).toHaveLength(2);
		expect(reports[0]).toContain('- **Total Colors**: 3');
		expect(reports[1]).toContain('- **Total Colors**: 2');
	});

	it('two Validate runs, the first held at its first quick pick, each validate their own document', async () => {
		registerValidateCommand(makeContext());
		_respondToQuickPick((items) => {
			const list = items as Array<{ value?: unknown; label?: string }>;
			if (list.some((i) => i.value === 'all'))
				return list.find((i) => i.value === 'all');
			return list.filter((i) => i.label === 'Format validation');
		});
		const hold = holdFirst(vscode.window, 'showQuickPick');
		try {
			_setActiveEditor(redDoc());
			const first = handler('colors-le.validate')();
			await hold.reached;
			_setActiveEditor(blueDoc());
			await handler('colors-le.validate')();
			hold.release();
			await first;
		} finally {
			hold.restore();
		}
		const summaries = _shownMessages()
			.filter((m) => m.kind === 'info')
			.map((m) => m.message);
		expect(summaries).toEqual([
			'Color validation completed. 3 valid, 0 invalid, 0 errors, 0 warnings.',
			'Color validation completed. 2 valid, 0 invalid, 0 errors, 0 warnings.',
		]);
		expect(_openedDocuments()).toHaveLength(2);
	});

	it('two Help runs, the first held at openTextDocument, open two help documents', async () => {
		registerHelpCommand(makeContext(), makeDeps());
		const hold = holdFirst(workspace, 'openTextDocument');
		try {
			const first = handler('colors-le.help')();
			await hold.reached;
			await handler('colors-le.help')();
			hold.release();
			await first;
		} finally {
			hold.restore();
		}
		const docs = _openedDocuments().map((d) => d.getText().split('\n')[0]);
		expect(docs).toEqual(['# Colors-LE Help', '# Colors-LE Help']);
	});

	it('two Open Settings runs both reach the settings UI', async () => {
		registerOpenSettingsCommand(makeContext(), makeDeps().telemetry);
		await Promise.all([
			handler('colors-le.openSettings')(),
			handler('colors-le.openSettings')(),
		]);
		expect(executedBuiltins.map((b) => [b.id, b.args[0]])).toEqual([
			['workbench.action.openSettings', 'colors-le'],
			['workbench.action.openSettings', 'colors-le'],
		]);
	});
});

describe('two invocations at once: the folder and workspace scans', () => {
	beforeEach(() => {
		_setWorkspaceFiles({
			'/w/a/one.css': 'a { color: #aa0000; }\n',
			'/w/b/two.css': 'b { color: #00bb00; }\nc { color: #00bb00; }\n',
		});
		workspace.workspaceFolders = [{ uri: Uri.file('/w'), name: 'w', index: 0 }];
		registerExtractWorkspaceCommands(makeContext(), makeDeps());
	});

	it('two folder scans, the first held at its first file read, each report their own folder', async () => {
		const hold = holdFirst(workspace.fs, 'readFile');
		try {
			const first = handler('colors-le.extractFolder')(Uri.file('/w/a'));
			await hold.reached;
			await handler('colors-le.extractFolder')(Uri.file('/w/b'));
			hold.release();
			await first;
		} finally {
			hold.restore();
		}
		const reports = _openedDocuments().map((d) => d.getText());
		expect(reports).toHaveLength(2);
		expect(reports[0]).toContain('`#00bb00`');
		expect(reports[0]).not.toContain('`#aa0000`');
		expect(reports[1]).toContain('`#aa0000`');
		expect(reports[1]).not.toContain('`#00bb00`');
	});

	it('a workspace scan and a folder scan at once each count only what they read', async () => {
		const hold = holdFirst(workspace.fs, 'readFile');
		try {
			const first = handler('colors-le.extractWorkspace')();
			await hold.reached;
			await handler('colors-le.extractFolder')(Uri.file('/w/b'));
			hold.release();
			await first;
		} finally {
			hold.restore();
		}
		expect(
			_shownMessages()
				.filter((m) => m.kind === 'info')
				.map((m) => m.message),
		).toEqual([
			'1 distinct color(s), 2 occurrence(s) in 1 file(s)',
			'2 distinct color(s), 3 occurrence(s) in 2 file(s)',
		]);
	});
});
