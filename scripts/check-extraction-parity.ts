/**
 * Fails when the extension's colour extraction drifts from the shared
 * corpus, which the Rust CLI (crate/) also builds against.
 *
 * - extraction.json `documents`: every colour found in each corpus
 *   document, with its notation and 1-based position, for every format.
 *   The corpus deliberately holds the awkward cases — a multiline
 *   `rgb()` normalised to single spaces, a five-digit hex rejected, a
 *   commented-out declaration skipped, a named colour in prose that is
 *   not a colour.
 * - mcp-extract-colors.json: the `extract_colors` tool, which BOTH MCP
 *   servers offer and must answer identically.
 * - aliases.json: the language ids both frontends accept, and the
 *   formats both advertise. Hand-ported twice, they drifted silently
 *   once already.
 *
 * This checks only the extension's side. `cargo test` runs the crate's
 * implementation over the same files.
 *
 * The palette check has no entry here on purpose: the extension has no
 * equivalent, so there is nothing for it to drift from. See
 * crate/SPEC.md, "The palette check — the addition".
 *
 * Run: bun scripts/check-extraction-parity.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractColors } from '../src/extraction/extract';
import { ALIASES, SUPPORTED_FORMATS } from '../src/mcp/fileType';
import { TOOLS } from '../src/mcp/tools';

const ROOT = join(import.meta.dir, '..');
/** The corpus lives inside the crate so the published package is self-contained. */
const CORPUS = join(ROOT, 'crate', 'fixtures');
const failures: string[] = [];

function fail(message: string): void {
	failures.push(message);
}

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((item, i) => deepEqual(item, b[i]));
	}
	if (typeof a !== 'object' || typeof b !== 'object') return false;
	if (a === null || b === null) return false;
	const keysA = Object.keys(a).sort();
	const keysB = Object.keys(b).sort();
	if (!deepEqual(keysA, keysB)) return false;
	return keysA.every((key) =>
		deepEqual(
			(a as Record<string, unknown>)[key],
			(b as Record<string, unknown>)[key],
		),
	);
}

function readCorpus(name: string): unknown {
	return JSON.parse(readFileSync(join(CORPUS, name), 'utf8'));
}

function readDocument(name: string): string {
	return readFileSync(join(CORPUS, 'documents', name), 'utf8');
}

interface DocumentCase {
	readonly name: string;
	readonly file: string;
	readonly fileType: string;
	readonly expected: ReadonlyArray<{
		value: string;
		format: string;
		line: number;
		column: number;
	}>;
}

async function checkDocuments(): Promise<void> {
	const corpus = readCorpus('extraction.json') as {
		documents: readonly DocumentCase[];
	};
	if (corpus.documents.length === 0) fail('the corpus has no documents');

	for (const testCase of corpus.documents) {
		const result = await extractColors(
			readDocument(testCase.file),
			testCase.fileType,
		);
		const actual = [...result.colors].map((color) => ({
			value: color.value,
			format: color.format,
			// The engine nests these under `position`; the MCP tool
			// flattens them, and the corpus follows the tool because that
			// is the shape both servers publish.
			line: color.position.line,
			column: color.position.column,
		}));
		if (!deepEqual(actual, testCase.expected)) {
			fail(
				`document "${testCase.name}":\n  expected: ${JSON.stringify(testCase.expected)}\n  got:      ${JSON.stringify(actual)}`,
			);
		}
	}
}

/**
 * `extract_colors` is offered by BOTH MCP servers. They are meant to be
 * the same tool, not two similar ones, so the same corpus runs against
 * both: this function here, and `crate/src/mcp/extract.rs`'s own test
 * there.
 */
async function checkMcpExtractColors(): Promise<void> {
	const cases = readCorpus('mcp-extract-colors.json') as ReadonlyArray<{
		name: string;
		file?: string;
		content?: string;
		arguments: Record<string, unknown>;
		expected?: unknown;
		expectedError?: string;
	}>;

	const tool = TOOLS.find((t) => t.name === 'extract_colors');
	if (!tool) {
		fail('the extension no longer offers extract_colors');
		return;
	}

	for (const testCase of cases) {
		const args: Record<string, unknown> = { ...testCase.arguments };
		if (testCase.file !== undefined) args.content = readDocument(testCase.file);
		else if (testCase.content !== undefined) args.content = testCase.content;

		if (testCase.expectedError !== undefined) {
			try {
				await tool.handler(args);
				fail(
					`mcp extract "${testCase.name}": expected it to fail with ${JSON.stringify(testCase.expectedError)}`,
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (message !== testCase.expectedError) {
					fail(
						`mcp extract "${testCase.name}": expected error ${JSON.stringify(testCase.expectedError)}, got ${JSON.stringify(message)}`,
					);
				}
			}
			continue;
		}

		const actual = await tool.handler(args);
		if (!deepEqual(actual, testCase.expected)) {
			fail(
				`mcp extract "${testCase.name}":\n  expected: ${JSON.stringify(testCase.expected)}\n  got:      ${JSON.stringify(actual)}`,
			);
		}
	}
}

/**
 * The corpus has to keep holding the cases that are easy to get wrong,
 * or it stops being the thing that would notice them changing.
 */
function checkTheCorpusStillCoversTheAwkwardCases(): void {
	const corpus = readCorpus('extraction.json') as {
		documents: readonly DocumentCase[];
	};
	const every = corpus.documents.flatMap((testCase) => testCase.expected);
	const values = every.map((color) => color.value);

	if (!values.includes('rgb(17, 34, 51)')) {
		fail('the corpus no longer pins a multiline rgb() normalising to single spaces');
	}
	if (!values.some((value) => value === 'white' || value === 'transparent')) {
		fail('the corpus no longer pins a named colour');
	}
	if (values.some((value) => value.startsWith('#') && value.length === 6)) {
		fail('a five-digit hex is being reported as a colour');
	}

	// The prose rule, from both directions: an issue reference in Markdown is
	// not a colour, and the same digits in a token file are one.
	const prose = corpus.documents
		.filter((testCase) => testCase.fileType === 'markdown')
		.flatMap((testCase) => testCase.expected)
		.map((color) => color.value);
	if (prose.includes('#250')) {
		fail('an issue reference is being reported as a colour');
	}
	if (!prose.includes('#FFF')) {
		fail('the corpus no longer pins a short hex with letters as a colour');
	}
	if (!values.includes('#250')) {
		fail('no corpus case pins a short all-digit hex that IS a colour');
	}

	const formats = new Set(corpus.documents.map((testCase) => testCase.fileType));
	for (const format of [
		'css',
		'scss',
		'less',
		'html',
		'svg',
		'typescript',
		'markdown',
		'json',
	]) {
		if (!formats.has(format)) fail(`no corpus case reads ${format}`);
	}
}

/**
 * The two alias tables are one table, kept in two languages. Nothing
 * makes them agree except this check and the crate's own unit test
 * against the same file: `typescriptreact` was accepted here and refused
 * there for a whole release, and the answer it gave — no colours, no
 * error — is indistinguishable from a document with no colours in it.
 */
function checkTheAliasTablesAgree(): void {
	const shared = readCorpus('aliases.json') as {
		aliases: Readonly<Record<string, string>>;
		formats: readonly string[];
	};

	for (const [alias, format] of Object.entries(shared.aliases)) {
		const ours = ALIASES[alias];
		if (ours !== format) {
			fail(
				`alias "${alias}": the shared table says ${format}, this side says ${ours ?? 'nothing'}`,
			);
		}
	}
	for (const alias of Object.keys(ALIASES)) {
		if (!(alias in shared.aliases)) {
			fail(`alias "${alias}" is accepted here but is not in the shared table`);
		}
	}
	if (!deepEqual([...SUPPORTED_FORMATS], [...shared.formats])) {
		fail(
			`the advertised formats differ:\n  shared: ${JSON.stringify(shared.formats)}\n  here:   ${JSON.stringify(SUPPORTED_FORMATS)}`,
		);
	}
}

await checkDocuments();
checkTheCorpusStillCoversTheAwkwardCases();
checkTheAliasTablesAgree();
await checkMcpExtractColors();

if (failures.length > 0) {
	console.error(`Extraction parity FAILED (${failures.length}):\n`);
	for (const failure of failures) {
		console.error(`- ${failure}\n`);
	}
	process.exit(1);
}
console.log(
	'OK: every corpus case reproduces under the extension, and both MCP servers agree.',
);
