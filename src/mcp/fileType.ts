/**
 * Resolving a format hint from whatever an agent happens to send.
 *
 * The engine's own `determineFileType` accepts VS Code language ids and nothing
 * else, while an agent will send `sass`, `jsx`, `.CSS` or `theme.scss`.
 * Widening happens here rather than in the engine, whose behaviour is pinned by
 * characterization goldens.
 *
 * Nothing is refused. A name that resolves to nothing resolves to
 * `FALLBACK_FORMAT`, and the engine reads the document as raw text — which is
 * how a caller who knows nothing about a file still gets the colors in it.
 */

/**
 * Every language id the engine understands, keyed by what a caller might send.
 *
 * The same table lives in the Rust CLI, and the two are held equal by
 * `crate/fixtures/aliases.json` — checked there by a unit test and here by
 * `scripts/check-extraction-parity.ts`. Two hand-ported copies drift silently:
 * this side accepted `typescriptreact` while the CLI answered
 * `{"colors": [], "fileType": "unknown"}` for it.
 */
export const ALIASES: Readonly<Record<string, string>> = Object.freeze({
	css: 'css',
	scss: 'scss',
	sass: 'scss',
	less: 'less',
	stylus: 'stylus',
	styl: 'stylus',
	html: 'html',
	htm: 'html',
	xhtml: 'html',
	vue: 'html',
	svelte: 'html',
	javascript: 'javascript',
	js: 'javascript',
	jsx: 'javascript',
	mjs: 'javascript',
	cjs: 'javascript',
	javascriptreact: 'javascript',
	typescript: 'typescript',
	ts: 'typescript',
	tsx: 'typescript',
	mts: 'typescript',
	cts: 'typescript',
	typescriptreact: 'typescript',
	svg: 'svg',
	xml: 'xml',
	json: 'json',
	jsonc: 'json',
	yaml: 'yaml',
	yml: 'yaml',
	toml: 'toml',
	markdown: 'markdown',
	md: 'markdown',
	plaintext: 'plaintext',
	txt: 'plaintext',
});

/**
 * The formats a caller can name, for the tool schema's enum.
 *
 * Not the list of formats the engine *reads* — that is every format, because
 * anything absent here is read as raw text. It is the list a caller gets a
 * named answer for.
 */
export const SUPPORTED_FORMATS: readonly string[] = Object.freeze([
	'css',
	'scss',
	'less',
	'stylus',
	'html',
	'javascript',
	'typescript',
	'svg',
	'xml',
	'json',
	'yaml',
	'toml',
	'markdown',
	'plaintext',
]);

/**
 * What the engine reports when it recognises nothing.
 *
 * The document is still read, by the raw text scan. `unknown` names how much
 * was known about the file, not whether it was opened.
 */
export const FALLBACK_FORMAT = 'unknown';

function normalise(value: string): string {
	return value.trim().toLowerCase().replace(/^\./, '');
}

/**
 * Resolve a language id from an explicit format, else from a filename, else
 * `FALLBACK_FORMAT`.
 *
 * It used to return null and the tool refused the call. That protected against
 * one thing — a README's `#250` read as a color — which is now answered by a
 * rule about short hex in prose rather than by declining to read the document.
 */
export function resolveFormat(
	format: string | undefined,
	filename: string | undefined,
): string {
	if (format) {
		const direct = ALIASES[normalise(format)];
		if (direct) return direct;
	}

	if (filename) {
		const extension = filename.includes('.')
			? filename.slice(filename.lastIndexOf('.') + 1)
			: '';
		const inferred = ALIASES[normalise(extension)];
		if (inferred) return inferred;
	}

	return FALLBACK_FORMAT;
}
