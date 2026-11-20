#!/usr/bin/env node
/**
 * The three stdio servers this repo ships, driven as built: the extension's
 * (`dist/mcp-server.js`), the npm command line's (`cli/cli.js mcp`) and the
 * crate's (`crate/target/debug/colors-le mcp`). Needs `bun run build:mcp`,
 * `bun run build:cli` and `cargo build` in `crate/` first; a missing binary
 * is a failure, never a skip.
 *
 * One request split at every byte offset, two in one chunk, and a split
 * inside a multi-byte character, each answered exactly once. Twenty
 * requests before any reply, each answered with its own id and its own
 * result. Stdin closed mid-frame exits 0 and writes nothing. With
 * `--memory`: 200,000 calls one at a time, resident memory sampled, and the
 * last sample held within 15% of the one at the midpoint. One call in
 * flight, because replies a driver has not drained sit in the server's
 * write queue and read as its memory.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const SERVERS = [
	['extension', 'node', ['dist/mcp-server.js'], 'dist/mcp-server.js'],
	['npm command line', 'node', ['cli/cli.js', 'mcp'], 'cli/cli.js'],
	['crate', 'crate/target/debug/colors-le', ['mcp'], 'crate/target/debug/colors-le'],
];
const failures = [];
const fail = (server, what) => failures.push(`${server}: ${what}`);

const call = (id, content) =>
	`${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'extract_colors', arguments: { content, format: 'css' } } })}\n`;
const lines = (s) => s.split('\n').filter(Boolean).map((l) => JSON.parse(l));
const first = (reply) => reply?.result?.structuredContent?.data?.colors?.[0]?.value;

function run(cmd, args, chunks, gapMs = 0) {
	return new Promise((resolve) => {
		const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
		let out = '';
		let err = '';
		child.stdout.on('data', (d) => (out += d));
		child.stderr.on('data', (d) => (err += d));
		child.on('exit', (code) => resolve({ out, err, code }));
		(async () => {
			for (const c of chunks) {
				child.stdin.write(c);
				if (gapMs) await new Promise((r) => setTimeout(r, gapMs));
			}
			child.stdin.end();
		})();
	});
}

async function frames(name, cmd, args) {
	const msg = Buffer.from(call(1, '.a{color:#ff0000} /* ü → 色 */'));
	for (let at = 1; at < msg.length; at += 1) {
		const r = await run(cmd, args, [msg.subarray(0, at), msg.subarray(at)], 5);
		const got = lines(r.out);
		if (got.length !== 1 || got[0].id !== 1 || first(got[0]) !== '#ff0000')
			fail(name, `a request split at byte ${at} was answered ${JSON.stringify(r.out).slice(0, 120)}`);
	}
	const two = lines((await run(cmd, args, [call(1, '.a{color:#111111}') + call(2, '.b{color:#222222}')])).out);
	if (two.map((x) => `${x.id}${first(x)}`).join() !== '1#111111,2#222222')
		fail(name, 'two requests in one chunk were not each answered once');
	const wide = Buffer.from(call(1, '.a{content:"😀色"; color:#abcdef}'));
	const start = wide.indexOf(Buffer.from('😀'));
	for (let at = start + 1; at < start + 7; at += 1) {
		const got = lines((await run(cmd, args, [wide.subarray(0, at), wide.subarray(at)], 20)).out);
		const color = got[0]?.result?.structuredContent?.data?.colors?.[0];
		if (got.length !== 1 || color?.value !== '#abcdef' || color?.column !== 25)
			fail(name, `a request split inside a multi-byte character at byte ${at} was misread`);
	}
	const many = Array.from({ length: 20 }, (_, i) => call(100 + i, `.c{color:#${(0x100000 + i).toString(16)}}`));
	const replies = lines((await run(cmd, args, [many.join('')])).out);
	if (replies.length !== 20) fail(name, `20 requests in flight drew ${replies.length} replies`);
	for (const r of replies)
		if (first(r) !== `#${(0x100000 + r.id - 100).toString(16)}`)
			fail(name, `request ${r.id} was answered with another request's result`);
	const cut = await run(cmd, args, [Buffer.from(call(2, '.a{color:#ff0000}')).subarray(0, 30)]);
	if (cut.code !== 0 || cut.out !== '') fail(name, `stdin closed mid-frame: exit ${cut.code}, stdout ${JSON.stringify(cut.out)}`);
}

async function memory(name, cmd, args, calls) {
	const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'inherit'] });
	const rss = () => Math.round(Number(execFileSync('ps', ['-o', 'rss=', '-p', String(child.pid)]).toString().trim()) / 1024);
	let buf = '';
	let waiting = null;
	child.stdout.setEncoding('utf8');
	child.stdout.on('data', (d) => {
		buf += d;
		for (let i = buf.indexOf('\n'); i !== -1; i = buf.indexOf('\n')) {
			buf = buf.slice(i + 1);
			const w = waiting;
			waiting = null;
			w();
		}
	});
	const send = (s) => new Promise((resolve) => { waiting = resolve; child.stdin.write(s); });
	const doc = Array.from({ length: 40 }, (_, i) => `.c${i}{color:#${(i * 99991).toString(16).padStart(6, '0').slice(-6)}}`).join('\n');
	const samples = [];
	for (let i = 1; i <= calls; i += 1) {
		await send(call(i, `${doc}\n.x{color:#${(i % 0xffffff).toString(16).padStart(6, '0')}}`));
		if (i % (calls / 10) === 0) samples.push(rss());
	}
	child.stdin.end();
	console.log(`${name}: ${calls} calls, resident MB every ${calls / 10}: ${samples.join(' ')}`);
	const mid = samples[4];
	const last = samples.at(-1);
	if (last > mid * 1.15) fail(name, `resident memory grew from ${mid} MB at the midpoint to ${last} MB`);
}

const memoryMode = process.argv.includes('--memory');
for (const [name, cmd, args, built] of SERVERS) {
	if (!existsSync(built)) {
		fail(name, `${built} is not built`);
		continue;
	}
	if (memoryMode) await memory(name, cmd, args, 200_000);
	else await frames(name, cmd, args);
}
if (failures.length > 0) {
	for (const f of failures) console.error(`FAIL ${f}`);
	process.exit(1);
}
console.log(memoryMode ? 'memory flat on all three servers' : 'framing, concurrency and close hold on all three servers');
