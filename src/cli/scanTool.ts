/**
 * `colors_le_scan`, the tool the Rust server offers beside the shared
 * `extract_colors`: files or directories in, the same reports the command line
 * writes. `colors-le mcp` serves both, as the crate's `colors-le mcp` does, so
 * an agent configured with either binary sees the same two tools.
 */
import {
	envelope,
	invalidParams,
	readOptionalBoolean,
	readOptionalString,
	refuseUnknown,
} from '../mcp/envelope';
import {
	FALLBACK_FORMAT,
	resolveFormat,
	SUPPORTED_FORMATS,
} from '../mcp/fileType';
import type { ToolDefinition } from '../mcp/transport';
import { type FileReport, scanFile } from './scan';
import { collect } from './walk';

const DESCRIPTION =
	'Extract every color from files or directories, with the file it came from and its ' +
	'1-based line and column. Every file is read: stylesheets, markup, source, JSON, YAML, ' +
	'TOML and Markdown by name, anything else as raw text. Reads the filesystem; never ' +
	'writes to it, and never judges a color.';

/** The schema's properties, which `additionalProperties: false` closes. */
const SCAN_ARGUMENTS = [
	'path',
	'paths',
	'format',
	'dedupe',
	'hidden',
	'ignored',
] as const;

async function scan(args: Record<string, unknown>): Promise<unknown> {
	refuseUnknown(args, SCAN_ARGUMENTS);
	const inputs = requestedPaths(args);
	// Read as the schema types them: a `hidden: "yes"` was read as false, a
	// silence the schema never allowed.
	const flag = (name: string): boolean =>
		readOptionalBoolean(args, name) === true;
	const options = {
		dedupe: flag('dedupe'),
		palette: null,
		format: forcedFormat(args),
	};
	// A path that is not there is a fact about the filesystem, not the
	// schema: `collect` throws a plain Error, which is a tool failure.
	const targets = collect(inputs, {
		hidden: flag('hidden'),
		respectIgnore: !flag('ignored'),
	});

	// A binary file gets no report but is counted, so an agent comparing this
	// to a file listing does not have to guess why the numbers differ.
	let binarySkipped = 0;
	const reports: FileReport[] = [];
	for (const target of targets) {
		const examined = await scanFile(target, options);
		if (examined.kind === 'binary') {
			binarySkipped += 1;
			continue;
		}
		reports.push(examined.report);
	}

	const colors = reports.reduce(
		(sum, report) => sum + report.summary.colors,
		0,
	);
	const diagnostics = reports
		.filter((report) =>
			report.diagnostics.some((found) => found.severity === 'error'),
		)
		.map((report) => ({
			severity: 'warning' as const,
			code: 'unreadable',
			message: `${report.file} could not be read, so this scan does not cover it`,
		}));

	return envelope(
		'colors_le_scan',
		{ reports, colors, binarySkipped },
		reports.length,
		diagnostics,
		false,
	);
}

/**
 * A name that resolves to nothing is refused, not fallen back on: a caller who
 * mistyped `scss` would otherwise get the tree scanned as raw text with no sign
 * the format they named was never used. The schema lists the names it takes,
 * so one outside the list is a schema violation, not the tool's own failure.
 */
function forcedFormat(args: Record<string, unknown>): string | null {
	const name = readOptionalString(args, 'format');
	if (name === undefined) return null;
	const resolved = resolveFormat(name, undefined);
	if (resolved !== FALLBACK_FORMAT) return resolved;
	throw invalidParams(
		`${name} is not a format this names; one of: ${SUPPORTED_FORMATS.join(', ')}`,
	);
}

function requestedPaths(args: Record<string, unknown>): readonly string[] {
	const path = args.path;
	if (typeof path === 'string') return [path];
	if (path !== undefined) throw invalidParams('path must be a string');
	const paths = args.paths;
	if (!Array.isArray(paths)) {
		throw invalidParams('no file or directory was supplied to read');
	}
	// An entry that is not a string is named rather than dropped: `["dir", 7]`
	// was answered for `dir` alone and the 7 vanished without a word.
	const index = paths.findIndex((item) => typeof item !== 'string');
	if (index !== -1) {
		throw invalidParams(`entry ${index} of paths is not a string`);
	}
	if (paths.length === 0) throw invalidParams('the list of paths was empty');
	return paths as readonly string[];
}

export const SCAN_TOOL: ToolDefinition = Object.freeze({
	name: 'colors_le_scan',
	description: DESCRIPTION,
	inputSchema: {
		type: 'object',
		properties: {
			path: { type: 'string', description: 'a file or directory to read' },
			paths: {
				type: 'array',
				items: { type: 'string' },
				description: 'several files or directories, instead of `path`',
			},
			format: {
				type: 'string',
				enum: SUPPORTED_FORMATS,
				description:
					'Force a format for every file instead of inferring one per file name.',
			},
			dedupe: {
				type: 'boolean',
				default: false,
				description: 'Collapse repeated values to their first occurrence.',
			},
			hidden: {
				type: 'boolean',
				default: false,
				description: 'Walk hidden files and directories too.',
			},
			ignored: {
				type: 'boolean',
				default: false,
				description: 'Walk files excluded by .gitignore too.',
			},
		},
		additionalProperties: false,
	},
	handler: scan,
});
