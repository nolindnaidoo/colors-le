import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'nolindnaidoo.colors-le';

async function activate(): Promise<void> {
	const extension = vscode.extensions.getExtension(EXTENSION_ID);
	assert.ok(extension, `extension ${EXTENSION_ID} not found`);
	await extension.activate();
}

const settings = () => vscode.workspace.getConfiguration('colors-le');

describe('Colors-LE in a real host: settings and languages', function () {
	this.timeout(60_000);

	afterEach(async () => {
		await settings().update('showPositions', undefined, vscode.ConfigurationTarget.Global);
	});

	// The host hands out a snapshot, and the unit mock reads live.
	it('reads a setting changed after activation on the next run, without a reload', async () => {
		await activate();
		await settings().update('showPositions', true, vscode.ConfigurationTarget.Global);
		const document = await vscode.workspace.openTextDocument({
			content: 'a { color: #abcdef; }',
			language: 'css',
		});
		await vscode.window.showTextDocument(document);
		await vscode.commands.executeCommand('colors-le.extractColors');
		const results = vscode.workspace.textDocuments.find(
			(doc) => doc.languageId === 'plaintext' && doc.getText().includes('#abcdef'),
		);
		assert.ok(results, 'no results document');
		assert.strictEqual(results.getText(), '1:12\t#abcdef');
	});

	// The Quick Fix is registered per language id, and an id the host never
	// assigns registers a provider nothing reaches.
	it('registers the Quick Fix only for language ids, not file extensions', async () => {
		await activate();
		const known = await vscode.languages.getLanguages();
		// Contributed by a language extension when one is installed, and
		// absent from a host started with --disable-extensions.
		const fromExtensions = ['sass', 'stylus'];
		// The bundle does not export the list, so it is read from the source.
		const source = readFileSync(
			join(__dirname, '..', '..', 'src', 'providers', 'codeActions.ts'),
			'utf8',
		);
		const block = /SUPPORTED_LANGUAGES[^=]*=\s*Object\.freeze\(\[([^\]]*)\]/.exec(source)?.[1] ?? '';
		const listed = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
		assert.ok(listed.length > 0, 'could not read SUPPORTED_LANGUAGES');
		const unknown = listed.filter((id) => !known.includes(id) && !fromExtensions.includes(id));
		assert.deepStrictEqual(unknown, [], `not a language id in this host: ${unknown.join(', ')}`);
	});
});
