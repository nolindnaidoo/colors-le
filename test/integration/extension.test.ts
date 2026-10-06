import * as assert from 'node:assert';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
			'colors-le.extractWorkspace',
			'colors-le.extractFolder',
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

	it('offers its MCP server to agent mode', async () => {
		// The provider is registered against the id the manifest declares; a
		// mismatch leaves the tools invisible with nothing logged. Assert the
		// declaration and the API the floor was raised for, together — the
		// registration itself is only observable in a real host, which
		// scripts/e2e-vsix.js covers against the installed VSIX.
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		await extension?.activate();

		assert.strictEqual(
			typeof vscode.lm.registerMcpServerDefinitionProvider,
			'function',
			'this VS Code build predates the MCP provider API',
		);

		const providers = extension?.packageJSON.contributes
			.mcpServerDefinitionProviders as { id: string; label: string }[];
		assert.deepStrictEqual(
			providers.map((p) => p.id),
			['colors-le'],
		);
	});

	it('dedupe removes duplicate color lines from the active document', async () => {
		const editor = await openEditor(
			'#aabbcc\n#ddeeff\n#aabbcc\n#ddeeff',
			'plaintext',
		);

		await vscode.commands.executeCommand('colors-le.postProcess.dedupe');

		assert.strictEqual(editor.document.getText(), '#aabbcc\n#ddeeff');
	});
	it('extracts the palette of a folder from disk, one row per color across its spellings', async () => {
		const root = mkdtempSync(join(tmpdir(), 'colors-le-extract-'));
		for (const dir of ['styles', 'node_modules', 'generated']) mkdirSync(join(root, dir));
		writeFileSync(join(root, '.gitignore'), 'generated/\n');
		writeFileSync(join(root, 'styles', 'a.css'), 'a { color: #f00; background: #FF0000; }\nb { color: red; }\n');
		writeFileSync(join(root, 'styles', 'b.css'), 'c { color: rgb(255, 0, 0); outline-color: #00ff00; }\n');
		writeFileSync(join(root, 'node_modules', 'x.css'), 'd { color: #123456; }\n');
		writeFileSync(join(root, 'generated', 'g.css'), 'e { color: #654321; }\n');

		await vscode.commands.executeCommand('colors-le.extractFolder', vscode.Uri.file(root));

		const report = vscode.workspace.textDocuments.find(
			(doc) => doc.languageId === 'markdown' && doc.getText().includes('colors-le-extract-'),
		);
		assert.ok(report, 'no workspace report was opened');
		const text = report.getText();
		assert.match(text, /2 distinct color\(s\), 5 occurrence\(s\) in 2 file\(s\)/);
		assert.ok(text.includes('| `#ff0000` | `#FF0000`, `#f00`, `red`, `rgb(255, 0, 0)` | 4 | 2 |'));
		assert.ok(text.includes('- `styles/a.css` (3)\n- `styles/b.css`'));
		assert.ok(!text.includes('#123456') && !text.includes('#654321'));
		assert.match(text, /1 file\(s\) ignored by \.gitignore/);
	});
});
