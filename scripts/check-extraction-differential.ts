/**
 * Generates documents and requires the **shared tool** to answer
 * identically on both servers.
 *
 * `extract_colors` is one tool with one schema offered by two servers, and
 * an agent that reaches either must get the same answer. That is the
 * contract this checks, and it is exactly the class the `xml` bug belonged
 * to: `xml` ran the markup-HTML extractor in the crate and the markup-SVG
 * one in the extension, so a `fill` attribute was found by one and missed
 * by the other. One hand-written probe found it. A generator would have
 * found it on day one.
 *
 * `check-extraction-parity.ts` runs the corpus, which pins the cases
 * somebody thought of. This generates them: a format, a value, a wrapper
 * and a neighbourhood — including multi-byte neighbours, which is where
 * two regex engines disagree without anyone noticing.
 *
 * **What is NOT checked here.** The two surfaces around that tool are
 * allowed to differ and do: the crate walks trees, takes a palette, has
 * exit codes and writes JSON Lines with a `notation` field; the extension
 * is IDE-first and has none of that. Those are not drift, and asserting
 * one against the other would invent bugs. Deliberate divergences are
 * listed in crate/SPEC.md.
 *
 * Deterministic: the seed is printed on every run and reprinted on
 * failure, and the failing document is dumped with every non-ASCII
 * character escaped so it pastes straight into a test.
 *
 * Run: bun scripts/check-extraction-differential.ts [--seed N] [--count N]
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { TOOLS } from '../src/mcp/tools';

const ROOT = join(import.meta.dir, '..');

function argument(name: string, fallback: number): number {
	const at = process.argv.indexOf(`--${name}`);
	if (at === -1) return fallback;
	const raw = Number(process.argv[at + 1]);
	if (!Number.isFinite(raw)) throw new Error(`--${name} needs a number`);
	return raw;
}

const SEED = argument('seed', 20260812);
const COUNT = argument('count', 500);
const BINARY =
	process.env.COLORS_LE_BIN ??
	join(ROOT, 'crate', 'target', 'debug', 'colors-le');

/** mulberry32: small, seeded, and identical on every platform. */
function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * How the caller names the format, per format. Both a canonical name and
 * an alias, because the alias tables are hand-ported twice and drifted
 * silently once already, and a filename, because the tool resolves one.
 */
const NAMES: Readonly<Record<string, readonly string[]>> = {
	// The byte-order marks are deliberate. U+FEFF is whitespace to
	// JavaScript's `trim` and not to Rust's, so a name wearing one
	// resolved on one server and fell through to the raw scan on the
	// other — and the raw scan is where this crate's two prose rules
	// live, so the two disagreed about whether `#250` is a colour.
	css: ['css', '.CSS', '\ufeffcss', 'theme.css', '\ufefftheme.css'],
	scss: ['scss', 'sass', '\ufeffsass ', 'theme.scss'],
	less: ['less', 'plain.less'],
	stylus: ['stylus', 'styl', 'theme.styl'],
	html: ['html', 'htm', 'page.html'],
	javascript: ['javascript', 'jsx', 'app.mjs'],
	typescript: ['typescript', 'typescriptreact', 'theme.tsx'],
	svg: ['svg', 'icon.svg'],
	xml: ['xml', 'chart.xml'],
	json: ['json', 'jsonc', '\ufeffjson', 'tokens.json'],
	yaml: ['yaml', 'yml', 'compose.yml'],
	toml: ['toml', 'config.toml'],
	markdown: ['markdown', 'md', '\ufeffmd', 'notes.md'],
	plaintext: ['plaintext', 'txt', 'notes.txt'],
	// No extractor of its own: read as raw text and reported as `unknown`.
	unknown: ['klingon', 'main.py', 'Makefile'],
};

/**
 * Values, including the near-misses. A generator that only feeds colours
 * proves the two agree about colours; the disagreements live in what one
 * side rejects and the other does not.
 */
const VALUES: readonly string[] = [
	'#fff',
	'#FFF',
	'#abc',
	'#250',
	'#1a2b3c',
	'#1A2B3C',
	'#f0a8',
	'#1a2b3c80',
	'#12345',
	'rgb(255, 0, 0)',
	'rgb(1,2,3)',
	'rgba(0, 0, 0, 0.5)',
	'hsl(210, 50%, 40%)',
	'hsla(210, 50%, 40%, .5)',
	'rgb(1, 2)',
	'hsl(210, 50, 40)',
	'rgb(\n    17,\n    34,\n    51\n  )',
	'white',
	'transparent',
	'rebeccapurple',
	'orange juice',
	'currentColor',
	// The rest are why this file exists. JavaScript's regexes run without
	// the `u` flag, so `\b`, `\d` and `[a-z]` are ASCII there and Unicode
	// in Rust unless it says otherwise.
	'#abcé',
	'é#abc',
	'rgb(\u0661, 2, 3)',
	'rgb(1,\u00a02, 3)',
	'white\u212a',
	'#fff\u200b',
	// U+FEFF is whitespace to JavaScript and not to Rust; U+0085 is the
	// reverse. Both sit inside a functional call, whose whitespace is
	// stripped before its components are validated.
	'rgb(1,\ufeff2, 3)',
	'rgb(1,\u00852, 3)',
];

/** Where a colour can sit, per extractor family. `%s` is the value. */
const WRAPPERS: Readonly<Record<string, readonly string[]>> = {
	stylesheet: [
		'.a { color: %s; }',
		'.a {\n  background: %s;\n}',
		':root { --brand: %s }',
		'/* color: %s */',
		'// color: %s',
		'.a { content: "%s" }',
		'.a { border: 1px solid %s }',
		'.a{color:%s}',
	],
	markup: [
		'<div style="color: %s"></div>',
		'<style>.a { color: %s }</style>',
		'<rect fill="%s"/>',
		'<rect stroke="%s" />',
		'<rect\n\tfill="%s"\n/>',
		"<rect fill='%s'/>",
		'<chart bgcolor="%s"/>',
		'<stop stop-color="%s"/>',
		'<a href="%s">x</a>',
		'<rect data-fill="%s"/>',
		'<!-- fill="%s" -->',
		'<p>%s</p>',
	],
	source: [
		'const a = "%s";',
		"const a = '%s';",
		'const s = `color: %s;`;',
		'const a = { brand: "%s" };\n',
		'// %s',
		'/* %s */',
		'const a = "prefix %s suffix";',
		'export const theme = {\n\tbrand: "%s",\n};',
	],
	tokens: [
		'{\n  "brand": "%s"\n}',
		'brand: %s\n',
		'brand = "%s"\n',
		'{"brand":"%s"}',
		'colors:\n  - %s\n',
		'# brand: %s\n',
	],
	prose: [
		'Brand: %s\n',
		'The value %s appears mid-sentence.',
		'- token: %s',
		'| name | value |\n| --- | --- |\n| brand | %s |',
		'`%s`',
		'    %s',
	],
};

const FAMILY: Readonly<Record<string, keyof typeof WRAPPERS>> = {
	css: 'stylesheet',
	scss: 'stylesheet',
	less: 'stylesheet',
	stylus: 'stylesheet',
	html: 'markup',
	svg: 'markup',
	xml: 'markup',
	javascript: 'source',
	typescript: 'source',
	json: 'tokens',
	yaml: 'tokens',
	toml: 'tokens',
	markdown: 'prose',
	plaintext: 'prose',
	unknown: 'prose',
};

/**
 * What sits around the value. The multi-byte entries are deliberate:
 * every corpus document is ASCII, so the corpus cannot see a byte-length
 * or a word-boundary bug. `İ` lowercases to two characters and `ẞ` to
 * fewer bytes than it occupies, which is what slides an offset taken
 * from a lowercased copy into the middle of a character.
 */
const NEIGHBOURS: readonly string[] = [
	'',
	'\n',
	'\n\n',
	'/* café ☕ */\n',
	'<!-- café ☕ -->\n',
	'// naïve\n',
	'ééé ',
	'🎯 ',
	'İ ',
	'ẞ ',
	'<p>İ</p>',
	'a'.repeat(200),
	'\t',
	'\r\n',
	'The quick brown fox.\n',
	'"quoted"\n',
];

const TRAILERS: readonly string[] = [
	'',
	'\n',
	'\n\n',
	' ',
	'\t\n',
	'🎯',
	'\r\n',
];

interface Document {
	readonly id: number;
	readonly format: string;
	readonly content: string;
	readonly arguments: Record<string, unknown>;
}

function generate(): Document[] {
	const next = random(SEED);
	const pick = <T>(items: readonly T[]): T =>
		items[Math.floor(next() * items.length)] as T;
	const formats = Object.keys(NAMES);
	const documents: Document[] = [];

	for (let id = 0; id < COUNT; id++) {
		const format = formats[id % formats.length] as string;
		const wrapper = pick(
			WRAPPERS[FAMILY[format] as keyof typeof WRAPPERS] ?? [],
		);
		const content = `${pick(NEIGHBOURS)}${wrapper.replace('%s', pick(VALUES))}${pick(TRAILERS)}`;

		// Both ways a caller names a document, and the two optional
		// arguments the schema carries. All four are part of the tool.
		const name = pick(NAMES[format] ?? []);
		const args: Record<string, unknown> = name.includes('.')
			? { content, filename: name }
			: { content, format: name };
		if (next() < 0.2) args.dedupe = true;
		if (next() < 0.1) args.maxResults = 3;

		documents.push({ id, format, content, arguments: args });
	}
	return documents;
}

/** Every non-ASCII character escaped, so a failure pastes into a test. */
function escape(text: string): string {
	return JSON.stringify(text).replace(/[\u0080-\uffff]/g, (character) => {
		const code = character.charCodeAt(0).toString(16).padStart(4, '0');
		return `\\u${code}`;
	});
}

/**
 * JSON with its keys in a fixed order.
 *
 * "Byte-identical" is about the answer, not about which order two JSON
 * writers happen to emit a map in: serde_json sorts keys and an object
 * literal keeps insertion order, and neither is the contract.
 */
function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, item]) => item !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : 1));
	return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
}

function request(document: Document): string {
	return JSON.stringify({
		jsonrpc: '2.0',
		id: document.id,
		method: 'tools/call',
		params: { name: 'extract_colors', arguments: document.arguments },
	});
}

/**
 * The crate server's answers, keyed by request id.
 *
 * One process for the whole run: the server reads a request per line and
 * answers in order, so a request that kills it is the one after the last
 * answer — which is how the offending document gets named rather than
 * left for somebody to find.
 */
async function fromCrate(
	documents: readonly Document[],
): Promise<Map<number, unknown>> {
	const child = Bun.spawn([BINARY, 'mcp'], {
		stdin: 'pipe',
		stdout: 'pipe',
		stderr: 'pipe',
	});
	// Read while writing: 500 answers do not fit in a pipe buffer, and a
	// server blocked on writing them would never read the next request.
	const reading = new Response(child.stdout).text();
	const complaining = new Response(child.stderr).text();
	for (const document of documents) {
		child.stdin.write(`${request(document)}\n`);
	}
	await child.stdin.end();

	const [out, err] = await Promise.all([reading, complaining]);
	const answers = new Map<number, unknown>();
	for (const line of out.split('\n')) {
		if (line.trim() === '') continue;
		const response = JSON.parse(line) as {
			id: number;
			result?: { structuredContent?: unknown };
			error?: unknown;
		};
		if (response.error !== undefined) {
			throw new Error(
				`the crate server refused a call it offers: ${JSON.stringify(response.error)}`,
			);
		}
		answers.set(response.id, response.result?.structuredContent);
	}

	const exit = await child.exited;
	if (answers.size < documents.length) {
		const missing = documents.find((document) => !answers.has(document.id));
		throw new Error(
			`the crate server stopped after ${answers.size} of ${documents.length} answers ` +
				`(exit ${exit}) — seed ${SEED}\n` +
				`  first unanswered: id ${missing?.id} (${missing?.format})\n` +
				`  arguments: ${escape(JSON.stringify(missing?.arguments))}\n` +
				`  stderr: ${err.trim()}`,
		);
	}
	return answers;
}

async function fromExtension(document: Document): Promise<unknown> {
	const tool = TOOLS.find((candidate) => candidate.name === 'extract_colors');
	if (!tool) throw new Error('the extension no longer offers extract_colors');
	return tool.handler(document.arguments);
}

/** The binary has to exist before any of this means anything. */
function requireBinary(): void {
	const probe = spawnSync(BINARY, ['--version'], { encoding: 'utf8' });
	if (probe.error || probe.status !== 0) {
		throw new Error(
			`${BINARY} does not run. Build it first: (cd crate && cargo build --locked).`,
		);
	}
}

requireBinary();
const documents = generate();
console.log(
	`differential: ${documents.length} generated documents, seed ${SEED}`,
);

const crate = await fromCrate(documents);
const failures: string[] = [];

for (const document of documents) {
	const ours = canonical(crate.get(document.id));
	const theirs = canonical(await fromExtension(document));
	if (ours === theirs) continue;
	failures.push(
		`id ${document.id} (${document.format})\n` +
			`  arguments: ${escape(JSON.stringify(document.arguments))}\n` +
			`  crate:     ${ours}\n` +
			`  extension: ${theirs}`,
	);
}

if (failures.length > 0) {
	console.error(
		`\nThe shared extract_colors tool answers differently on ${failures.length} of ${documents.length} documents — seed ${SEED}.\n` +
			'Reproduce with --seed ' +
			`${SEED} --count ${COUNT}. This is the one contract both servers owe an agent:\n` +
			'one tool, one schema, one answer. A surface difference (the CLI walks trees, takes a\n' +
			'palette, names the field `notation`) does not reach this check — anything that fails\n' +
			'here is the shared extraction layer.\n',
	);
	for (const failure of failures) console.error(`- ${failure}\n`);
	process.exit(1);
}
console.log(
	`OK: extract_colors answers identically on both servers for all ${documents.length} documents.`,
);
