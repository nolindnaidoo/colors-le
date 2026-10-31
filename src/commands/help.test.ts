import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createExtensionContext,
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
} from '../__mocks__/vscode';
import { SUPPORTED_FORMATS } from '../mcp/fileType';
import { registerHelpCommand } from './help';

/**
 * The help document against the code it describes. Prose has no compiler:
 * it listed four file types after fourteen were read, five notations after
 * fourteen were found, and named the last command "Help" where the palette
 * shows "Help & Troubleshooting".
 */

const ROOT = join(__dirname, '..', '..');

function manifestCommandTitles(): string[] {
	const manifest = JSON.parse(
		readFileSync(join(ROOT, 'package.json'), 'utf8'),
	) as { contributes: { commands: Array<{ title: string }> } };
	const nls = JSON.parse(
		readFileSync(join(ROOT, 'package.nls.json'), 'utf8'),
	) as Record<string, string>;
	return manifest.contributes.commands
		.map((entry) => nls[entry.title.replace(/^%|%$/g, '')] ?? entry.title)
		.sort();
}

async function helpText(): Promise<string> {
	registerHelpCommand(_createExtensionContext() as never, {
		telemetry: { event: () => {}, dispose: () => {} },
		notifier: {
			showInfo: () => {},
			showWarning: () => {},
			showError: () => {},
			showProgress: async (_title, task) =>
				task({ report: () => {} }, {
					isCancellationRequested: false,
				} as never),
		},
		statusBar: {
			showProgress: () => {},
			hideProgress: () => {},
			dispose: () => {},
		},
	});
	const handler = _registeredCommands().get('colors-le.help');
	if (!handler) throw new Error('help command not registered');
	await handler();
	return _openedDocuments().at(-1)?.getText() ?? '';
}

beforeEach(() => {
	_resetMockState();
});

describe('help', () => {
	it('opens as a markdown document', async () => {
		const help = await helpText();
		expect(_openedDocuments().at(-1)?.languageId).toBe('markdown');
		expect(help.startsWith('# Colors-LE Help')).toBe(true);
	});

	it('names every command the manifest declares, under the title the palette shows', async () => {
		const help = await helpText();
		const section = help.split('## Commands')[1]?.split('\n## ')[0] ?? '';
		const named = [...section.matchAll(/^- \*\*([^*]+)\*\*/gm)]
			.map((match) => match[1] as string)
			.sort();
		expect(named).toEqual(manifestCommandTitles());
	});

	it('names every format the extractor reads by name, and the raw-text scan for the rest', async () => {
		// The MCP schema's enum is the list of formats a parser reads; the
		// document names each of them in the words a user knows.
		const help = await helpText();
		const formats =
			help.split('## Supported Formats')[1]?.split('\n## ')[0] ?? '';
		for (const name of [
			'CSS',
			'SCSS',
			'LESS',
			'Stylus',
			'HTML',
			'JavaScript',
			'TypeScript',
			'SVG',
			'XML',
			'JSON',
			'YAML',
			'TOML',
			'Markdown',
			'plain text',
		]) {
			expect(formats, name).toContain(name);
		}
		expect(SUPPORTED_FORMATS).toHaveLength(14);
		expect(formats).toMatch(/every other document is scanned/i);
		expect(help).not.toMatch(/Supported File Types/);
	});

	it('names every notation the extractor finds', async () => {
		const help = await helpText();
		for (const notation of [
			'#rgb',
			'#rgba',
			'#rrggbb',
			'#rrggbbaa',
			'rgb()',
			'rgba()',
			'hsl()',
			'hsla()',
			'hwb()',
			'lab()',
			'lch()',
			'oklab()',
			'oklch()',
			'color()',
			'named colors',
		]) {
			expect(help, notation).toContain(notation);
		}
	});

	it('does not tell a user to check the file type, since every document is read', async () => {
		const help = await helpText();
		expect(help).not.toMatch(/file type is supported/i);
		expect(help).toMatch(/every document is scanned whatever its language/i);
	});
});
