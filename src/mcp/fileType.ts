/**
 * Resolving a format hint from whatever an agent happens to send.
 *
 * The engine's own `determineFileType` accepts VS Code language ids and nothing
 * else — `scss`, `javascriptreact`, `typescriptreact` and the rest fall through
 * to `unknown`, which extracts nothing and explains nothing. An agent will send
 * `sass`, `jsx`, `.CSS` or `theme.scss` instead. Widening happens here rather
 * than in the engine, whose behaviour is pinned by characterization goldens.
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
});

/** The formats a caller can name, for the tool schema's enum. */
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
]);

function normalise(value: string): string {
	return value.trim().toLowerCase().replace(/^\./, '');
}

/**
 * Resolve a language id from an explicit format, else from a filename.
 *
 * Returns null rather than guessing: a wrong format extracts nothing and looks
 * like an empty document, which is the least debuggable outcome for a caller.
 */
export function resolveFormat(
	format: string | undefined,
	filename: string | undefined,
): string | null {
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

	return null;
}
