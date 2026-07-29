import * as assert from 'node:assert';
import * as vscode from 'vscode';

const EXTENSION_ID = 'nolindnaidoo.colors-le';

async function openEditor(
	content: string,
	language: string,
): Promise<vscode.TextEditor> {
	const document = await vscode.workspace.openTextDocument({
		content,
		language,
	});
	return vscode.window.showTextDocument(document);
}

describe('Colors-LE integration', function () {
	this.timeout(30_000);

	it('activates', async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		assert.ok(extension, `extension ${EXTENSION_ID} not found`);
		await extension.activate();
		assert.strictEqual(extension.isActive, true);
	});

	it('registers every declared command', async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		await extension?.activate();
		const commands = await vscode.commands.getCommands(true);
		for (const id of [
			'colors-le.extractColors',
			'colors-le.analyze',
			'colors-le.convert',
			'colors-le.filter',
			'colors-le.validate',
			'colors-le.postProcess.dedupe',
			'colors-le.postProcess.sort',
			'colors-le.openSettings',
			'colors-le.help',
		]) {
			assert.ok(commands.includes(id), `missing command: ${id}`);
		}
	});

	it('extracts colors from a CSS document into a results document', async () => {
		await openEditor(
			[
				':root {',
				'\t--brand: #ff0000;',
				'\t--muted: rgb(1,',
				'\t\t2, 3);',
				'}',
				'.card { box-shadow: 0 0 2px navy; }',
			].join('\n'),
			'css',
		);

		await vscode.commands.executeCommand('colors-le.extractColors');

		// Results open in a new plaintext document (side-by-side default).
		const resultDoc = vscode.workspace.textDocuments.find(
			(doc) =>
				doc.languageId === 'plaintext' && doc.getText().includes('#ff0000'),
		);
		assert.ok(resultDoc, 'no results document found');
		const lines = resultDoc.getText().split('\n');
		assert.deepStrictEqual(lines, ['#ff0000', 'rgb(1, 2, 3)', 'navy']);
	});

	it('dedupe removes duplicate color lines from the active document', async () => {
		const editor = await openEditor(
			'#aabbcc\n#ddeeff\n#aabbcc\n#ddeeff',
			'plaintext',
		);

		await vscode.commands.executeCommand('colors-le.postProcess.dedupe');

		assert.strictEqual(editor.document.getText(), '#aabbcc\n#ddeeff');
	});
});
