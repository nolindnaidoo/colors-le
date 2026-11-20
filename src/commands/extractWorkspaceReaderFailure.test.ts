import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
	_setWorkspaceFiles,
	Uri,
	workspace,
} from '../__mocks__/vscode';
import { createNotifier } from '../ui/notifier';
import { registerExtractWorkspaceCommands } from './extractWorkspace';

// A reader that throws, which no real document is known to make it do.
vi.mock('../extraction/formats/css', () => ({
	extractFromCss: () => {
		throw new Error('reader failed');
	},
}));

beforeEach(() => {
	_resetMockState();
	registerExtractWorkspaceCommands(
		{ subscriptions: [] as Array<{ dispose(): void }> } as never,
		{
			telemetry: { event: () => {}, dispose: () => {} },
			notifier: createNotifier(),
			statusBar: {
				showProgress: () => {},
				hideProgress: () => {},
				dispose: () => {},
			},
			ratingPrompt: { recordSuccess: async () => {} },
		},
	);
});

describe('a file the reader throws on', () => {
	it('is named in the folder report rather than counted as read and clean', async () => {
		_setWorkspaceFiles({
			'/w/broken.css': 'a { color: #111111; }\n',
			'/w/fine.md': 'The brand is #abcdef.\n',
		});
		workspace.workspaceFolders = [{ uri: Uri.file('/w'), name: 'w', index: 0 }];
		await _registeredCommands().get('colors-le.extractWorkspace')?.();
		const report = _openedDocuments().at(-1)?.getText() ?? '';
		expect(report).toContain('#abcdef');
		expect(report).toContain(
			'> Colors could not be read from 1 file(s), so they are not in this report: `/w/broken.css`',
		);
	});
});
