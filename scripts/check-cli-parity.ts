/**
 * Requires the npm command line to behave exactly as the Rust one does.
 *
 * Both install a command named `colors-le`, so a person or a CI step cannot
 * tell which one they have. This is a different contract from
 * `check-extraction-parity.ts`, which holds the extension's engine equal to
 * the crate's: here the whole terminal surface is compared, the walk, the
 * palette, the exit codes, stdout and stderr byte for byte, and the two tools
 * `colors-le mcp` serves.
 *
 * Every case runs both binaries over one generated tree with stdout piped,
 * which is how a script sees them. `--version` is not compared: the crate and
 * the npm package are versioned separately.
 *
 * Run: bun run build:cli && cargo build --locked --manifest-path crate/Cargo.toml
 *      bun scripts/check-cli-parity.ts
 */
import { spawnSync } from 'node:child_process';
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmdirSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const RUST = process.env.COLORS_LE_BIN ?? join(ROOT, 'crate', 'target', 'debug', 'colors-le');
const NODE_CLI = join(ROOT, 'cli', 'cli.js');

interface Case {
	readonly args: readonly string[];
	readonly stdin?: string | Buffer;
}

interface Outcome {
	readonly status: number | null;
	readonly stdout: string;
	readonly stderr: string;
}

for (const [label, path] of [
	['the Rust binary', RUST],
	['cli/cli.js', NODE_CLI],
] as const) {
	if (!existsSync(path)) {
		console.error(`FAIL: ${label} is missing at ${path}. Build it first.`);
		process.exit(1);
	}
}

const tree = mkdtempSync(join(tmpdir(), 'colors-le-cli-parity-'));
const created: string[] = [];
const dirs: string[] = [tree];

function dir(relative: string): void {
	mkdirSync(join(tree, relative));
	dirs.push(join(tree, relative));
}

function file(relative: string, content: string | Buffer): void {
	writeFileSync(join(tree, relative), content);
	created.push(join(tree, relative));
}

function build(): void {
	dir('repo');
	dir('repo/.git');
	dir('repo/.git/info');
	file('repo/.git/info/exclude', 'excluded.css\n');
	file('repo/.gitignore', 'ignored.css\nbuild/\n*.log\n!keep.log\n');
	file('repo/ignored.css', '.a{color:#ff0000}\n');
	file('repo/excluded.css', '.a{color:#00ff00}\n');
	file('repo/kept.css', '.a{color:#1a2b3c}\n.b{color:rgb(255, 255, 255)}\n.c{color:white}\n');
	file('repo/a.css', '.a{color:#abc}\n');
	dir('repo/a');
	file('repo/a/b.css', '.b{color:#def}\n');
	file('repo/noise.log', '#abcdef\n');
	file('repo/keep.log', '#abcdef\n');
	dir('repo/build');
	file('repo/build/out.css', '.x{color:#123456}\n');
	dir('repo/nested');
	file('repo/nested/.gitignore', '!ignored.css\nlocal.css\n');
	file('repo/nested/ignored.css', '.n{color:#654321}\n');
	file('repo/nested/local.css', '.n{color:#111111}\n');
	file('repo/nested/.ignore', 'dot-ignored.css\n');
	file('repo/nested/dot-ignored.css', '.n{color:#222222}\n');
	file('repo/.hidden.css', '.h{color:#333333}\n');
	dir('repo/.hiddendir');
	file('repo/.hiddendir/in.css', '.h{color:#444444}\n');
	file('repo/logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x1a, 0x0a]));
	file('repo/latin1.css', Buffer.from([0x2e, 0x61, 0x7b, 0xe9, 0x7d, 0x0a]));
	file('repo/bom.css', '﻿.a{color:#0a0b0c}\n');
	file('repo/empty.css', '');
	file('repo/blank.css', '   \n\n');
	file('repo/notes.md', 'fixed in #250, colour #fab and orange\n');
	file('repo/tokens.json', '{"paper": "white", "ink": "#250", "brand": "#2563EB"}\n');
	file('repo/page.html', '<svg><rect fill="#1a2b3c"/></svg><p style="color: red">x</p>\n');
	file('repo/app.tsx', "const c = '#ABCDEF'; // #000000\n");
	file('repo/theme.scss', '// #deadbe\n$a: #1a2b3c;\n.a{color:hsl(120, 50%, 50%)}\n');
	file('repo/Makefile', 'COLOR=#fedcba\n');
	file('repo/ünïcode.css', '.u{color:#a1b2c3}\n');
	file('repo/modern.css', '.m{color:oklch(0.7 0.1 200)}\n.n{color:rgb(1 2 3 / 50%)}\n');
	symlinkSync(join(tree, 'repo', 'kept.css'), join(tree, 'repo', 'link.css'));
	created.push(join(tree, 'repo', 'link.css'));

	dir('loose');
	file('loose/.gitignore', 'not-a-repo.css\n');
	file('loose/not-a-repo.css', '.l{color:#555555}\n');
	file('loose/.ignore', 'dot.css\n');
	file('loose/dot.css', '.l{color:#666666}\n');

	file('palette.txt', '#1a2b3c\n"#FFFFFF",\n// a comment\nwhite\nnot-a-colour\n#\n');
	file('palette.json', '["#1A2B3C", "rgb(255,255,255)", "teal", "#12345"]');
	file('palette-object.json', '{"z": "#abc", "10": "nope", "a": "#def", "2": "#1a2b3c"}');
	file('palette-empty.txt', 'nothing here\n');
	file('palette-bom.txt', '\uFEFF#ffffff\n');
	file('palette-bom.json', '\uFEFF["#1a2b3c", "bogus"]');
	file('palette-latin1.txt', Buffer.from([0x23, 0x66, 0x66, 0x66, 0x0a, 0xe9]));

	if (process.platform !== 'win32' && process.getuid?.() !== 0) {
		file('repo/locked.css', '.l{color:#777777}\n');
		chmodSync(join(tree, 'repo', 'locked.css'), 0o000);
	}
}

function cases(): readonly Case[] {
	const repo = join(tree, 'repo');
	const fixtures = join(ROOT, 'crate', 'fixtures');
	const palette = (name: string): string => join(tree, name);
	return [
		{ args: ['--help'] },
		{ args: ['-h'] },
		{ args: [] },
		{ args: [repo] },
		{ args: [`${repo}/`] },
		{ args: [repo, '--dedupe'] },
		{ args: [repo, '--values'] },
		{ args: [repo, '--values', '--dedupe'] },
		{ args: [repo, '--hidden'] },
		{ args: [repo, '--no-ignore'] },
		{ args: [repo, '--hidden', '--no-ignore'] },
		{ args: [repo, '--strict'] },
		{ args: [repo, '--format', 'css'] },
		{ args: [repo, '--format', 'SCSS'] },
		{ args: [repo, '--format', '.md'] },
		{ args: [repo, '--format', 'python'] },
		{ args: [repo, '--format'] },
		{ args: [repo, '--palette', palette('palette.txt')] },
		{ args: [repo, '--palette', palette('palette.json'), '--values'] },
		{ args: [repo, '--palette', palette('palette-object.json')] },
		{ args: [repo, '--palette', palette('palette-empty.txt')] },
		{ args: [repo, '--palette', palette('palette-bom.txt')] },
		{ args: [repo, '--palette', palette('palette-bom.json')] },
		{ args: [repo, '--palette', palette('palette-latin1.txt')] },
		{ args: [repo, '--palette', palette('missing.txt')] },
		{ args: [repo, '--palette'] },
		{ args: [join(repo, 'ignored.css'), join(repo, '.hidden.css'), join(repo, 'kept.css')] },
		{ args: [join(repo, 'kept.css'), join(repo, 'kept.css')] },
		{ args: [join(repo, 'a.css'), join(repo, 'a')] },
		{ args: [join(repo, 'logo.png')] },
		{ args: [join(repo, 'latin1.css'), '--strict'] },
		{ args: [join(repo, 'empty.css')] },
		{ args: [join(repo, 'nested')] },
		{ args: [join(tree, 'loose')] },
		{ args: [join(tree, 'missing')] },
		{ args: [repo, '--dedup'] },
		{ args: [repo, '--help'] },
		{ args: [repo, '-'] },
		{ args: ['--stdin'] },
		{ args: ['--stdin', repo] },
		{ args: ['--stdin', '--format', 'css'], stdin: '.a{color:#1a2b3c}\n.b{color:red}\n' },
		{ args: ['--stdin', '--format', 'css'], stdin: '﻿.a{color:#1a2b3c}\n' },
		{ args: ['--stdin', '--format', 'css'], stdin: Buffer.from([0x2e, 0xff, 0x0a]) },
		{ args: ['--stdin', '--format', 'markdown', '--values'], stdin: '#250 and #fab\n' },
		{ args: ['--stdin', '--format', 'css'], stdin: '' },
		{
			args: ['--stdin', '--format', 'css', '--palette', palette('palette.txt')],
			stdin: '.a{color:#fff}\n.b{color:#000}\n',
		},
		{ args: [fixtures] },
		{ args: [fixtures, '--dedupe', '--no-ignore', '--hidden'] },
		{ args: [join(ROOT, 'src', 'extraction', '__fixtures__')] },
	];
}

function runOne(command: readonly string[], testCase: Case): Outcome {
	const [program, ...rest] = command as [string, ...string[]];
	const result = spawnSync(program, [...rest, ...testCase.args], {
		input: testCase.stdin ?? '',
		cwd: tree,
	});
	return {
		status: result.status,
		stdout: result.stdout.toString('utf8'),
		stderr: result.stderr.toString('utf8'),
	};
}

function compareCli(): string[] {
	const failures: string[] = [];
	for (const testCase of cases()) {
		const rust = runOne([RUST], testCase);
		const node = runOne([process.execPath, NODE_CLI], testCase);
		for (const field of ['status', 'stdout', 'stderr'] as const) {
			if (rust[field] === node[field]) continue;
			failures.push(
				`colors-le ${testCase.args.join(' ')}\n  ${field} differs\n` +
					`  rust: ${JSON.stringify(rust[field])}\n  node: ${JSON.stringify(node[field])}`,
			);
		}
	}
	return failures;
}

/** Key order is not compared: the crate's JSON values are sorted maps. */
function canonical(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonical);
	if (typeof value !== 'object' || value === null) return value;
	return Object.fromEntries(
		Object.keys(value)
			.sort()
			.map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
	);
}

/** Tool results with the text half parsed, so pretty-printing order cannot differ. */
function comparable(response: Record<string, unknown>): unknown {
	const result = response.result as Record<string, unknown> | undefined;
	const content = result?.content as { type: string; text: string }[] | undefined;
	if (!content || result?.isError === true) return canonical(response);
	const parsed = content.map((item) => ({ ...item, text: JSON.parse(item.text) }));
	return canonical({ ...response, result: { ...result, content: parsed } });
}

function mcpRequests(): readonly Record<string, unknown>[] {
	const repo = join(tree, 'repo');
	const call = (id: number, name: string, args: Record<string, unknown>) => ({
		jsonrpc: '2.0',
		id,
		method: 'tools/call',
		params: { name, arguments: args },
	});
	return [
		call(1, 'colors_le_scan', { path: repo }),
		call(2, 'colors_le_scan', { paths: [repo, join(tree, 'loose')], dedupe: true }),
		call(3, 'colors_le_scan', { path: repo, hidden: true, ignored: true, format: 'css' }),
		call(4, 'colors_le_scan', { path: repo, format: 'klingon' }),
		call(5, 'colors_le_scan', { paths: [] }),
		call(6, 'colors_le_scan', {}),
		call(7, 'colors_le_scan', { path: join(tree, 'missing') }),
		call(8, 'extract_colors', { content: '.a{color:#1a2b3c}', format: 'css' }),
	];
}

function serve(command: readonly string[], requests: readonly unknown[]): unknown[] {
	const [program, ...rest] = command as [string, ...string[]];
	const input = `${requests.map((request) => JSON.stringify(request)).join('\n')}\n`;
	const result = spawnSync(program, [...rest, 'mcp'], { input, encoding: 'utf8', cwd: tree });
	return result.stdout
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line));
}

function compareMcp(): string[] {
	const failures: string[] = [];
	const list = { jsonrpc: '2.0', id: 0, method: 'tools/list', params: {} };
	const requests = [list, ...mcpRequests()];
	const rust = serve([RUST], requests) as Record<string, unknown>[];
	const node = serve([process.execPath, NODE_CLI], requests) as Record<string, unknown>[];
	// By id, not by line: the npm server answers each call as it finishes,
	// which JSON-RPC allows, so its replies need not arrive in request order.
	const byId = (replies: Record<string, unknown>[], id: unknown) =>
		replies.find((reply) => reply.id === id) ?? {};
	requests.forEach((request) => {
		const left = JSON.stringify(comparable(byId(rust, request.id)));
		const right = JSON.stringify(comparable(byId(node, request.id)));
		if (left === right) return;
		failures.push(
			`colors-le mcp ${JSON.stringify((request as { params: unknown }).params)}\n` +
				`  rust: ${left}\n  node: ${right}`,
		);
	});
	return failures;
}

function cleanUp(): void {
	const locked = join(tree, 'repo', 'locked.css');
	if (existsSync(locked)) chmodSync(locked, 0o600);
	for (const path of created) unlinkSync(path);
	for (const path of [...dirs].reverse()) rmdirSync(path);
}

build();
let failures: string[];
try {
	failures = [...compareCli(), ...compareMcp()];
} finally {
	cleanUp();
}

if (failures.length > 0) {
	console.error(failures.join('\n\n'));
	console.error(`\nFAIL: ${failures.length} difference(s) between the npm and Rust CLIs`);
	process.exit(1);
}
console.log(`OK: the npm CLI matches the Rust CLI on ${cases().length} commands and the MCP surface`);
