/**
 * The command line, parsed as the Rust CLI parses it: strictly, in order, and
 * refusing rather than defaulting. A typo'd `--dedup` that quietly did nothing
 * would produce a report the caller believed was deduplicated.
 */
import {
	FALLBACK_FORMAT,
	resolveFormat,
	SUPPORTED_FORMATS,
} from '../mcp/fileType';
import { rustIoMessage } from './ioError';
import { isEmptyPalette, type Palette, parsePalette } from './palette';
import type { ScanOptions } from './scan';
import { FLAGS } from './usage';
import type { WalkOptions } from './walk';

export interface Cli {
	readonly strict: boolean;
	readonly inputs: readonly string[];
	readonly stdin: boolean;
	readonly valuesOnly: boolean;
	readonly scan: ScanOptions;
	readonly walk: WalkOptions;
}

export interface ParseDeps {
	readonly readFile: (path: string) => string;
	/** Where a rejected palette entry is named, as it is read. */
	readonly warn: (line: string) => void;
}

type Draft = { -readonly [K in keyof Cli]: Cli[K] };

export function parse(args: readonly string[], deps: ParseDeps): Cli {
	const draft: Draft = {
		strict: false,
		inputs: [],
		stdin: false,
		valuesOnly: false,
		scan: { dedupe: false, format: null, palette: null },
		walk: { hidden: false, respectIgnore: true },
	};

	for (let index = 0; index < args.length; index++) {
		const arg = args[index] as string;
		if (arg.startsWith('-') && !FLAGS.includes(arg)) {
			throw new Error(`${arg} is not an option. Try --help.`);
		}
		const takesValue = arg === '--format' || arg === '--palette';
		const value = takesValue ? args[++index] : undefined;
		apply(draft, arg, value, deps);
	}

	if (draft.stdin && draft.inputs.length > 0) {
		throw new Error('reading from stdin takes no file arguments');
	}
	if (!draft.stdin && draft.inputs.length === 0) {
		throw new Error('name a file or a directory to read. Try --help.');
	}
	return Object.freeze(draft);
}

const SWITCHES: Readonly<Record<string, (draft: Draft) => void>> =
	Object.freeze({
		'--dedupe': (draft) => {
			draft.scan = { ...draft.scan, dedupe: true };
		},
		'--values': (draft) => {
			draft.valuesOnly = true;
		},
		'--stdin': (draft) => {
			draft.stdin = true;
		},
		'--strict': (draft) => {
			draft.strict = true;
		},
		'--hidden': (draft) => {
			draft.walk = { ...draft.walk, hidden: true };
		},
		'--no-ignore': (draft) => {
			draft.walk = { ...draft.walk, respectIgnore: false };
		},
	});

function apply(
	draft: Draft,
	arg: string,
	value: string | undefined,
	deps: ParseDeps,
): void {
	const toggle = SWITCHES[arg];
	if (toggle) {
		toggle(draft);
		return;
	}
	if (arg === '--format') {
		draft.scan = { ...draft.scan, format: forcedFormat(value) };
		return;
	}
	if (arg === '--palette') {
		draft.scan = { ...draft.scan, palette: readPalette(value, deps) };
		return;
	}
	draft.inputs = [...draft.inputs, arg];
}

/**
 * A typo is refused even though an unnamed format would be read: `--fromat
 * scss` silently scanning the tree as raw text is a run whose caller believes
 * it parsed stylesheets.
 */
function forcedFormat(value: string | undefined): string {
	if (value === undefined) throw new Error('--format needs a format');
	const resolved = resolveFormat(value, undefined);
	if (resolved !== FALLBACK_FORMAT) return resolved;
	throw new Error(
		`${value} is not a format this names; one of: ${SUPPORTED_FORMATS.join(', ')}`,
	);
}

function readPalette(value: string | undefined, deps: ParseDeps): Palette {
	if (value === undefined) throw new Error('--palette needs a file');
	let text: string;
	try {
		text = deps.readFile(value);
	} catch (error) {
		throw new Error(
			`could not read the palette ${value}: ${rustIoMessage(error)}`,
		);
	}
	const { palette, rejected } = parsePalette(text);
	if (isEmptyPalette(palette))
		throw new Error(`${value} holds no colours this can read`);
	// Said out loud rather than skipped: a typo in a palette silently approving
	// nothing is the worst outcome here.
	for (const entry of rejected)
		deps.warn(`colors-le: ${value}: ${entry} is not a colour`);
	return palette;
}
