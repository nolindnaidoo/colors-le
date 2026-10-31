import {
	mkdirSync,
	mkdtempSync,
	rmdirSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { TOOLS } from '../mcp/tools';
import { parse } from './args';
import { rustIoMessage } from './ioError';
import { serve } from './mcp';
import { isEmptyPalette, paletteContains, parsePalette } from './palette';
import { run } from './run';
import { exitCode, scanContent } from './scan';
import { SCAN_TOOL } from './scanTool';
import { FLAGS, USAGE } from './usage';
import { collect, DEFAULT_WALK } from './walk';

const plain = Object.freeze({ dedupe: false, format: null, palette: null });
const noDeps = Object.freeze({
	readFile: (): string => {
		throw new Error('no palette in this test');
	},
	warn: (): void => {},
});

describe('usage', () => {
	it('names every flag the parser accepts, and no other', () => {
		const named = new Set(
			USAGE.split(/\s+/)
				.filter((word) => word.startsWith('--'))
				.map((word) => word.replace(/[,.:;]+$/, ''))
				.filter((word) => word !== '--version' && word !== '--help'),
		);
		expect([...named].sort()).toEqual([...FLAGS].sort());
	});

	it('offers no judgment beyond the palette', () => {
		for (const word of ['contrast', 'wcag', 'convert'])
			expect(USAGE).not.toContain(word);
	});
});

describe('parse', () => {
	it('refuses an unknown flag rather than ignoring it', () => {
		expect(() => parse(['--dedup', 'x'], noDeps)).toThrow(
			'--dedup is not an option',
		);
	});

	it('refuses a format it does not name, and resolves one it does', () => {
		expect(() => parse(['--format', 'python', 'x'], noDeps)).toThrow('python');
		expect(parse(['--format', 'SASS', 'x'], noDeps).scan.format).toBe('scss');
	});

	it('refuses a flag with no value', () => {
		expect(() => parse(['--format'], noDeps)).toThrow(
			'--format needs a format',
		);
		expect(() => parse(['--palette'], noDeps)).toThrow(
			'--palette needs a file',
		);
	});

	it('refuses naming nothing, and stdin with files', () => {
		expect(() => parse([], noDeps)).toThrow('name a file or a directory');
		expect(() => parse(['--stdin', 'x'], noDeps)).toThrow(
			'takes no file arguments',
		);
	});

	it('names each palette entry it could not read', () => {
		const warned: string[] = [];
		const options = parse(['--palette', 'p.txt', 'x'], {
			readFile: () => '#fff\nbogus\n',
			warn: (line) => warned.push(line),
		});
		expect(options.scan.palette).not.toBeNull();
		expect(warned).toEqual(['colors-le: p.txt: bogus is not a colour']);
	});

	it('refuses a palette that holds nothing', () => {
		const deps = { readFile: () => 'nothing\n', warn: () => {} };
		expect(() => parse(['--palette', 'p.txt', 'x'], deps)).toThrow(
			'holds no colours',
		);
	});
});

describe('palette', () => {
	it('compares by colour, across notations', () => {
		const { palette } = parsePalette('#ffffff\n#1a2b3c');
		expect(paletteContains(palette, 'rgb(255, 255, 255)')).toBe(true);
		expect(paletteContains(palette, '#FFF')).toBe(true);
		expect(paletteContains(palette, 'hsl(0, 0%, 100%)')).toBe(true);
		expect(paletteContains(palette, '#ff0000')).toBe(false);
	});

	it('keeps a named colour equal only to itself', () => {
		const { palette } = parsePalette('white');
		expect(paletteContains(palette, 'WHITE')).toBe(true);
		expect(paletteContains(palette, '#ffffff')).toBe(false);
	});

	it('treats alpha as part of the colour', () => {
		const { palette } = parsePalette('#000000');
		expect(paletteContains(palette, 'rgba(0, 0, 0, 0.5)')).toBe(false);
	});

	it('reads a JSON array and a flat object', () => {
		expect(parsePalette('["#abc", 1, "teal"]').rejected).toEqual([]);
		const object = parsePalette('{"b": "#def", "a": "nope"}');
		expect(object.rejected).toEqual(['nope']);
		expect(isEmptyPalette(object.palette)).toBe(false);
	});

	it('refuses what is not a colour, and skips comments and blanks', () => {
		const { rejected } = parsePalette('// note\n\n#\n#12345\n"#abc",\n');
		expect(rejected).toEqual(['#12345']);
	});

	it('reads a palette saved with a byte-order mark', () => {
		for (const text of ['\uFEFF#1a2b3c\n', '\uFEFF["#1a2b3c"]']) {
			const { palette, rejected } = parsePalette(text);
			expect(rejected).toEqual([]);
			expect(paletteContains(palette, '#1a2b3c')).toBe(true);
		}
	});

	it('reads a modern colour', () => {
		const { palette } = parsePalette('rgb(255 0 0)');
		expect(paletteContains(palette, '#ff0000')).toBe(true);
	});
});

describe('scan', () => {
	it('exits 0 with colours, 1 with none, 1 outside the palette', async () => {
		const found = await scanContent('.a{color:#1a2b3c}', 'a.css', 'css', plain);
		const none = await scanContent('.a{display:block}', 'a.css', 'css', plain);
		expect(exitCode([found], false)).toBe(0);
		expect(exitCode([none], false)).toBe(1);
		expect(exitCode([], false)).toBe(1);

		const palette = parsePalette('#1a2b3c').palette;
		const judged = await scanContent('.a{color:#ff0000}', 'a.css', 'css', {
			...plain,
			palette,
		});
		expect(judged.colors[0]?.inPalette).toBe(false);
		expect(exitCode([judged], false)).toBe(1);
	});

	it('carries no verdict without a palette', async () => {
		const report = await scanContent(
			'.a{color:#1a2b3c}',
			'a.css',
			'css',
			plain,
		);
		expect(JSON.stringify(report)).not.toContain('inPalette');
	});

	it('dedupes by text, not by colour', async () => {
		const content = '.a{color:#FFF}\n.b{color:#ffffff}\n.c{color:#FFF}';
		const report = await scanContent(content, 'a.css', 'css', {
			...plain,
			dedupe: true,
		});
		expect(report.colors.map((color) => color.value)).toEqual([
			'#FFF',
			'#ffffff',
		]);
	});

	it('reads an empty document as no colours, not an error', async () => {
		const report = await scanContent('', 'a.css', 'css', plain);
		expect(report.diagnostics).toEqual([]);
		expect(report.summary.colors).toBe(0);
	});
});

describe('ioError', () => {
	it('speaks as Rust does about a missing file', () => {
		const error = Object.assign(
			new Error("ENOENT: no such file or directory, stat 'x'"),
			{
				code: 'ENOENT',
				errno: -2,
			},
		);
		expect(rustIoMessage(error, 'darwin')).toBe(
			'No such file or directory (os error 2)',
		);
	});

	const failure = (code: string, errno: number, path?: string) =>
		Object.assign(new Error(`${code}: failed`), { code, errno, path });

	it('speaks as Rust does on Linux and Windows too', () => {
		expect(rustIoMessage(failure('EBUSY', -16), 'darwin')).toBe(
			'Resource busy (os error 16)',
		);
		expect(rustIoMessage(failure('EBUSY', -16), 'linux')).toBe(
			'Device or resource busy (os error 16)',
		);
		expect(rustIoMessage(failure('EPERM', -4048), 'win32')).toBe(
			'Access is denied. (os error 5)',
		);
	});

	/** libuv folds both Windows codes into ENOENT, numbered -4058. */
	it('tells a missing file from a missing directory on Windows', () => {
		const root = mkdtempSync(join(tmpdir(), 'io-error-'));
		writeFileSync(join(root, 'file'), '');
		const missing = (...parts: string[]) =>
			rustIoMessage(failure('ENOENT', -4058, join(root, ...parts)), 'win32');
		try {
			expect(missing('gone')).toBe(
				'The system cannot find the file specified. (os error 2)',
			);
			expect(missing('no', 'gone')).toBe(
				'The system cannot find the path specified. (os error 3)',
			);
			expect(missing('file', 'gone')).toBe(
				'The system cannot find the path specified. (os error 3)',
			);
		} finally {
			unlinkSync(join(root, 'file'));
			rmdirSync(root);
		}
	});
});

describe('walk and run', () => {
	const made: string[] = [];
	const dirs: string[] = [];

	function tree(files: Record<string, string>): string {
		const root = mkdtempSync(join(tmpdir(), 'colors-le-cli-test-'));
		dirs.push(root);
		for (const [name, content] of Object.entries(files)) {
			const parts = name.split('/');
			for (let depth = 1; depth < parts.length; depth++) {
				const dir = join(root, ...parts.slice(0, depth));
				if (dirs.includes(dir)) continue;
				mkdirSync(dir);
				dirs.push(dir);
			}
			writeFileSync(join(root, name), content);
			made.push(join(root, name));
		}
		return root;
	}

	afterEach(() => {
		for (const file of made.splice(0)) unlinkSync(file);
		for (const dir of dirs.splice(0).reverse()) rmdirSync(dir);
	});

	it('sorts by component, as Rust sorts a path', () => {
		const root = tree({ 'a.css': '', 'a/b.css': '', 'z.css': '' });
		// The walk keeps the platform's separator, as the crate's does; a
		// report turns it into `/` later.
		const walked = collect([root], DEFAULT_WALK).map((path) =>
			path.slice(root.length + 1),
		);
		expect(walked).toEqual([join('a', 'b.css'), 'a.css', 'z.css']);
	});

	it('honours .gitignore only inside a repository, and .ignore anywhere', () => {
		const loose = tree({
			'.gitignore': 'a.css\n',
			'.ignore': 'b.css\n',
			'a.css': '',
			'b.css': '',
		});
		const names = collect([loose], DEFAULT_WALK).map((path) =>
			path.slice(loose.length + 1),
		);
		expect(names).toEqual(['a.css']);
	});

	it('passes over hidden entries unless asked', () => {
		const root = tree({ '.hidden.css': '', 'shown.css': '' });
		expect(collect([root], DEFAULT_WALK)).toHaveLength(1);
		expect(collect([root], { ...DEFAULT_WALK, hidden: true })).toHaveLength(2);
	});

	it('writes JSON Lines to a pipe and the summary to stderr', async () => {
		const root = tree({ 'a.css': '.a{color:#2563eb}\n' });
		let out = '';
		let err = '';
		const code = await run([join(root, 'a.css')], {
			stdout: (text) => {
				out += text;
			},
			stderr: (text) => {
				err += text;
			},
			stdoutIsTerminal: false,
			readStdin: async () => new Uint8Array(),
			version: '0.0.0',
		});
		expect(code).toBe(0);
		expect(JSON.parse(out).colors[0]).toEqual({
			value: '#2563eb',
			notation: 'hex',
			line: 1,
			column: 10,
		});
		expect(err.endsWith('1 color in 1 file\n')).toBe(true);
	});

	it('writes nothing to a terminal but the values it was asked for', async () => {
		const root = tree({ 'a.css': '.a{color:#2563eb}\n' });
		let out = '';
		const io = {
			stdout: (text: string) => {
				out += text;
			},
			stderr: () => {},
			stdoutIsTerminal: true,
			readStdin: async () => new Uint8Array(),
			version: '0.0.0',
		};
		await run([root], io);
		expect(out).toBe('');
		await run([root, '--values'], io);
		expect(out).toBe('#2563eb\n');
	});

	it('refuses stdin without a format before reading it, with exit 2', async () => {
		let err = '';
		const code = await run(['--stdin'], {
			stdout: () => {},
			stderr: (text) => {
				err += text;
			},
			stdoutIsTerminal: false,
			readStdin: async () => {
				throw new Error('stdin was read');
			},
			version: '0.0.0',
		});
		expect(code).toBe(2);
		expect(err).toBe('colors-le: reading from stdin needs --format\n');
	});
});

describe('mcp: the crate framing', () => {
	// The protocol around the tools answers as the extension's server and
	// the crate's answer, so a client cannot tell the three apart by what it
	// sent. Replies are parsed: key order is the crate's concern, not this one.
	async function session(
		lines: readonly (string | Uint8Array)[],
	): Promise<{ status: number; replies: unknown[] }> {
		const written: string[] = [];
		const input = Readable.from(lines.map((item) => Buffer.from(item)));
		const status = await serve(
			input,
			(line) => {
				written.push(line);
				return undefined;
			},
			{ name: 'colors-le', version: '9.9.9' },
			[],
		);
		return { status, replies: written.map((line) => JSON.parse(line)) };
	}

	it("answers a malformed frame in the extension server's words and serves the next line", async () => {
		// A frame that is not JSON, or not UTF-8, was dropped without a word,
		// and a client lost every request it then waited on.
		const { status, replies } = await session([
			'{"jsonrpc":"2.0","id":1,"method":"initialize"}\n',
			'{"jsonrpc":"2.0","method":"notifications/initialized"}\n',
			'not json\n',
			Uint8Array.from([0x7b, 0xff, 0x7d, 0x0a]),
			'   \n',
			'{"jsonrpc":"2.0","id":2,"method":"nope"}\n',
		]);
		expect(status).toBe(0);
		expect(replies).toEqual([
			{
				jsonrpc: '2.0',
				id: 1,
				result: {
					protocolVersion: '2025-06-18',
					capabilities: { tools: {} },
					serverInfo: { name: 'colors-le', version: '9.9.9' },
				},
			},
			{
				jsonrpc: '2.0',
				id: null,
				error: { code: -32700, message: 'Invalid JSON' },
			},
			{
				jsonrpc: '2.0',
				id: null,
				error: { code: -32700, message: 'Invalid JSON' },
			},
			{
				jsonrpc: '2.0',
				id: 2,
				error: { code: -32601, message: 'Unknown method: nope' },
			},
		]);
	});

	it('refuses malformed frames in the words the other two servers use, and a null id is a notification', async () => {
		const { replies } = await session([
			'{"id":1,"method":"ping"}\n',
			'{"jsonrpc":"1.0","id":2,"method":"ping"}\n',
			'[{"jsonrpc":"2.0","id":3,"method":"ping"}]\n',
			'{"jsonrpc":"2.0","id":null,"method":"ping"}\n',
			'{"jsonrpc":"2.0","id":4,"method":"notifications/initialized"}\n',
			'{"jsonrpc":"2.0","id":5,"method":"tools/call","params":5}\n',
			'{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"nope"}}\n',
			'{"jsonrpc":"2.0","id":7,"method":"tools/call"}\n',
			'{"jsonrpc":"2.0","id":8,"method":"initialize","params":{"protocolVersion":"1999-01-01"}}\n',
		]);
		const refused = {
			jsonrpc: '2.0',
			id: null,
			error: { code: -32700, message: 'Not a JSON-RPC 2.0 request' },
		};
		expect(replies).toEqual([
			refused,
			refused,
			refused,
			{
				jsonrpc: '2.0',
				id: 4,
				error: {
					code: -32601,
					message: 'Unknown method: notifications/initialized',
				},
			},
			{
				jsonrpc: '2.0',
				id: 5,
				error: { code: -32602, message: 'tools/call requires a string `name`' },
			},
			{
				jsonrpc: '2.0',
				id: 6,
				error: { code: -32602, message: 'Unknown tool: nope' },
			},
			{
				jsonrpc: '2.0',
				id: 7,
				error: { code: -32602, message: 'tools/call requires a string `name`' },
			},
			{
				jsonrpc: '2.0',
				id: 8,
				result: {
					capabilities: { tools: {} },
					protocolVersion: '2025-06-18',
					serverInfo: { name: 'colors-le', version: '9.9.9' },
				},
			},
		]);
	});

	it('waits for the pipe to drain before reading the next frame', async () => {
		const lines: string[] = [];
		let drained = 0;
		const input = Readable.from([
			Buffer.from(
				'{"jsonrpc":"2.0","id":1,"method":"ping"}\n{"jsonrpc":"2.0","id":2,"method":"ping"}\n',
			),
		]);
		const write = (line: string) => {
			lines.push(line);
			return new Promise<void>((resolve) =>
				setTimeout(() => {
					drained += 1;
					resolve();
				}, 1),
			);
		};
		await serve(input, write, { name: 'colors-le', version: '9.9.9' }, []);
		expect(lines).toHaveLength(2);
		expect(drained).toBe(2);
	});
});

describe('mcp: the tools over the crate framing', () => {
	// The same loop as above, with the two tools `colors-le mcp` serves.
	async function session(
		lines: readonly string[],
	): Promise<{ status: number; written: string[] }> {
		const written: string[] = [];
		const input = Readable.from(lines.map((item) => Buffer.from(item)));
		const status = await serve(
			input,
			(line) => {
				written.push(line);
				return undefined;
			},
			{ name: 'colors-le', version: '9.9.9' },
			[...TOOLS, SCAN_TOOL],
		);
		return { status, written };
	}

	const call = (name: string, args: string) =>
		`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"${name}","arguments":${args}}}\n`;
	const refusal = (reply: string) => JSON.parse(reply).error;

	it('refuses a wrong-typed or undeclared argument as a protocol error, and a path that is not there as a tool failure', async () => {
		// A `hidden: "yes"` was read as false and a `format: 7` as absent, and
		// an argument the schema does not declare was accepted, on this
		// server and the crate's alike. A path that is not there is a fact
		// about the filesystem, not the schema: a result carrying isError.
		const { written } = await session([
			call('extract_colors', '{"content":"x","format":7}'),
			call('extract_colors', '{"content":"x","format":"css","dedupe":"yes"}'),
			call('extract_colors', '{"content":"x","format":"css","filename":7}'),
			call(
				'extract_colors',
				'{"content":"x","format":"css","bogus":1,"another":2}',
			),
			call('colors_le_scan', '{"path":"x","hidden":"yes"}'),
			call('colors_le_scan', '{"path":"x","bogus":1}'),
			call('colors_le_scan', '{"path":"x","format":"klingon"}'),
			call('colors_le_scan', '{"path":"/no/such/place-xyz"}'),
		]);
		expect(written.slice(0, 7).map(refusal)).toEqual([
			{ code: -32602, message: 'format must be a string' },
			{ code: -32602, message: 'dedupe must be a boolean' },
			{ code: -32602, message: 'filename must be a string' },
			{ code: -32602, message: 'unknown arguments: another, bogus' },
			{ code: -32602, message: 'hidden must be a boolean' },
			{ code: -32602, message: 'unknown argument: bogus' },
			{
				code: -32602,
				message:
					'klingon is not a format this names; one of: css, scss, less, stylus, html, javascript, typescript, svg, xml, json, yaml, toml, markdown, plaintext',
			},
		]);
		const failure = JSON.parse(written[7] as string).result;
		expect(failure.isError).toBe(true);
		expect(failure.content[0].text).toContain('/no/such/place-xyz');
	});

	it('names a path entry that is not a string rather than dropping it, and refuses a scan that names nothing', async () => {
		// `["dir", 7]` was answered for `dir` alone and the 7 vanished without
		// a word, on this server and the crate's alike.
		const { written } = await session([
			call('colors_le_scan', '{"paths":["a",7]}'),
			call('colors_le_scan', '{"paths":[null]}'),
			call('colors_le_scan', '{"path":7}'),
			call('colors_le_scan', '{"paths":[]}'),
			call('colors_le_scan', '{}'),
		]);
		expect(written.map(refusal)).toEqual([
			{ code: -32602, message: 'entry 1 of paths is not a string' },
			{ code: -32602, message: 'entry 0 of paths is not a string' },
			{ code: -32602, message: 'path must be a string' },
			{ code: -32602, message: 'the list of paths was empty' },
			{ code: -32602, message: 'no file or directory was supplied to read' },
		]);
	});

	it('reads a cap written as an exponent or an integer-valued float as the crate does', async () => {
		// JSON Schema's `integer` is any number with a zero fractional part;
		// the crate refused `5.0` and `1e3` where this server and the
		// extension's accepted them.
		const content = '.a{color:#1a2b3c}\\n.b{color:#ffffff}';
		const { written } = await session([
			call(
				'extract_colors',
				`{"content":"${content}","format":"css","maxResults":1E20}`,
			),
			call(
				'extract_colors',
				`{"content":"${content}","format":"css","maxResults":1.0}`,
			),
		]);
		const metas = written.map(
			(reply) => JSON.parse(reply).result.structuredContent.meta,
		);
		expect(metas).toEqual([
			{ tool: 'extract_colors', count: 2, truncated: false },
			{ tool: 'extract_colors', count: 1, truncated: true },
		]);
	});
});
