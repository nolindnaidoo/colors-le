import {
	mkdirSync,
	mkdtempSync,
	rmdirSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parse } from './args';
import { rustIoMessage } from './ioError';
import { isEmptyPalette, paletteContains, parsePalette } from './palette';
import { run } from './run';
import { exitCode, scanContent } from './scan';
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
		expect(rustIoMessage(error)).toBe('No such file or directory (os error 2)');
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
		const walked = collect([root], DEFAULT_WALK).map((path) =>
			path.slice(root.length + 1),
		);
		expect(walked).toEqual(['a/b.css', 'a.css', 'z.css']);
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
