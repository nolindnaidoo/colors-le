/**
 * The terminal surface, as the Rust CLI's `cli.rs` runs it.
 *
 * stdout is protocol: one JSON report per line whenever something is reading
 * it, and nothing when it is a terminal, because the stderr summary already
 * lists every colour a person reads there. `--values` prints wherever stdout
 * goes, because it is plain text a person asked to see.
 */
import { type Cli, parse } from './args';
import { decodeUtf8OrThrow, readUtf8File, rustIoMessage } from './ioError';
import {
	describe,
	exitCode,
	type FileReport,
	scanContent,
	scanFile,
} from './scan';
import { USAGE } from './usage';
import { collect } from './walk';

export interface RunIo {
	readonly stdout: (text: string) => void;
	readonly stderr: (text: string) => void;
	readonly stdoutIsTerminal: boolean;
	readonly readStdin: () => Promise<Uint8Array>;
	readonly version: string;
}

export async function run(args: readonly string[], io: RunIo): Promise<number> {
	const first = args[0];
	if (first === '--help' || first === '-h') {
		io.stdout(`${USAGE}\n`);
		return 0;
	}
	if (first === '--version' || first === '-V') {
		io.stdout(`colors-le ${io.version}\n`);
		return 0;
	}

	try {
		return await execute(args, io);
	} catch (error) {
		io.stderr(
			`colors-le: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		return 2;
	}
}

async function execute(args: readonly string[], io: RunIo): Promise<number> {
	const options = parse(args, {
		readFile: readUtf8File,
		warn: (line) => io.stderr(`${line}\n`),
	});
	const { reports, binary } = options.stdin
		? { reports: [await scanStdin(options, io)], binary: 0 }
		: await readTree(options);

	io.stdout(
		options.valuesOnly
			? values(reports)
			: jsonLines(reports, io.stdoutIsTerminal),
	);
	io.stderr(summary(reports, binary, options.valuesOnly));
	return exitCode(reports, options.strict);
}

/**
 * A binary file gets no report line, since it was never a text candidate, but
 * it is counted, because silence about files that were never looked at is the
 * thing this tool exists to avoid.
 */
async function readTree(
	options: Cli,
): Promise<{ reports: FileReport[]; binary: number }> {
	const reports: FileReport[] = [];
	let binary = 0;
	for (const target of collect(options.inputs, options.walk)) {
		const examined = await scanFile(target, options.scan);
		if (examined.kind === 'binary') {
			binary += 1;
			continue;
		}
		reports.push(examined.report);
	}
	return { reports, binary };
}

/**
 * Checked before reading: a missing format waiting for end of input before it
 * is refused would hang a caller who forgot it. The stdin document keeps any
 * byte-order mark, as the crate's does.
 */
async function scanStdin(options: Cli, io: RunIo): Promise<FileReport> {
	const format = options.scan.format;
	if (!format) throw new Error('reading from stdin needs --format');
	let content: string;
	try {
		content = decodeUtf8OrThrow(await io.readStdin());
	} catch (error) {
		throw new Error(`could not read stdin: ${rustIoMessage(error)}`);
	}
	return scanContent(content, '<stdin>', format, options.scan);
}

function jsonLines(reports: readonly FileReport[], terminal: boolean): string {
	if (terminal) return '';
	return reports.map((report) => `${JSON.stringify(report)}\n`).join('');
}

function values(reports: readonly FileReport[]): string {
	return reports
		.flatMap((report) => report.colors.map((found) => `${found.value}\n`))
		.join('');
}

/**
 * The human half. Every line restates something already on stdout, except the
 * binary count, the one fact stdout deliberately omits. Under `--values` the
 * colours are on stdout already, so they are not repeated here.
 */
function summary(
	reports: readonly FileReport[],
	binary: number,
	valuesOnStdout: boolean,
): string {
	const lines: string[] = [];
	for (const report of reports) {
		for (const diagnostic of report.diagnostics) {
			lines.push(`${report.file}: ${diagnostic.message}`);
		}
		if (valuesOnStdout) continue;
		for (const found of report.colors) lines.push(describe(report, found));
	}

	const colors = reports.reduce(
		(sum, report) => sum + report.summary.colors,
		0,
	);
	const outside = reports.reduce(
		(sum, report) => sum + report.summary.outsidePalette,
		0,
	);
	const passedOver =
		binary === 0
			? ''
			: `, ${plural(binary, 'binary file', 'binary files')} skipped`;
	lines.push(
		`${plural(colors, 'color', 'colors')} in ${plural(reports.length, 'file', 'files')}${passedOver}`,
	);
	if (outside > 0) {
		lines.push(
			`${plural(outside, 'colour is', 'colours are')} not in the palette`,
		);
	}
	return lines.map((line) => `${line}\n`).join('');
}

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}
