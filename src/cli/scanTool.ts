/**
 * `colors_le_scan`, the tool the Rust server offers beside the shared
 * `extract_colors`: files or directories in, the same reports the command line
 * writes. `colors-le mcp` serves both, as the crate's `colors-le mcp` does, so
 * an agent configured with either binary sees the same two tools.
 */
import { envelope } from '../mcp/envelope';
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

async function scan(args: Record<string, unknown>): Promise<unknown> {
	const inputs = requestedPaths(args);
	const flag = (name: string): boolean => args[name] === true;
	const options = {
		dedupe: flag('dedupe'),
		palette: null,
		format: forcedFormat(args),
	};
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
 * the format they named was never used.
 */
function forcedFormat(args: Record<string, unknown>): string | null {
	const name = args.format;
	if (typeof name !== 'string') return null;
	const resolved = resolveFormat(name, undefined);
	if (resolved !== FALLBACK_FORMAT) return resolved;
	throw new Error(
		`${name} is not a format this names; one of: ${SUPPORTED_FORMATS.join(', ')}`,
	);
}

function requestedPaths(args: Record<string, unknown>): readonly string[] {
	if (typeof args.path === 'string') return [args.path];
	if (!Array.isArray(args.paths))
		throw new Error('no file or directory was supplied to read');
	const paths = args.paths.filter(
		(item): item is string => typeof item === 'string',
	);
	if (paths.length === 0) throw new Error('the list of paths was empty');
	return paths;
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
	},
	handler: scan,
});
