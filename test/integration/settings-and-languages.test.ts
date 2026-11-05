import * as assert from 'node:assert';
import * as vscode from 'vscode';

const EXTENSION_ID = 'nolindnaidoo.colors-le';

async function activate(): Promise<void> {
	const extension = vscode.extensions.getExtension(EXTENSION_ID);
	assert.ok(extension, `extension ${EXTENSION_ID} not found`);
	await extension.activate();
}

const settings = () => vscode.workspace.getConfiguration('colors-le');

describe('Colors-LE in a real host: settings', function () {
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
});
