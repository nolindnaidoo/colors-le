import { extractColors } from '../extraction/extract';
import {
	capped,
	DEFAULT_MAX_RESULTS,
	envelope,
	MAX_MAX_RESULTS,
	readMaxResults,
	readString,
	toDiagnostics,
} from './envelope';
import { resolveFormat, SUPPORTED_FORMATS } from './fileType';
import type { ToolDefinition } from './transport';

/**
 * The tools this server exposes.
 *
 * Names are a public API with no deprecation channel — once an agent's prompt
 * or memory references `extract_colors`, renaming it breaks silently. They are
 * pinned by a golden test for that reason.
 *
 * No tool touches the filesystem. The agent already has file-read tools;
 * duplicating them here would add a path-traversal surface for no capability.
 */

const MAX_RESULTS_SCHEMA = {
	type: 'integer',
	minimum: 1,
	maximum: MAX_MAX_RESULTS,
	default: DEFAULT_MAX_RESULTS,
	description: `Cap on returned colors (default ${DEFAULT_MAX_RESULTS}). meta.truncated reports whether any were dropped.`,
};

async function extract(args: Record<string, unknown>): Promise<unknown> {
	const content = readString(args, 'content');
	const maxResults = readMaxResults(args);

	const format = typeof args.format === 'string' ? args.format : undefined;
	const filename =
		typeof args.filename === 'string' ? args.filename : undefined;

	// Requiring one of the two up front gives a message naming the problem,
	// instead of the engine returning an empty result for an unknown language.
	const languageId = resolveFormat(format, filename);
	if (!languageId) {
		throw new Error(
			`Provide \`format\` (one of: ${SUPPORTED_FORMATS.join(', ')}) or a \`filename\` with a recognised extension.`,
		);
	}

	const result = await extractColors(content, languageId);
	const values = result.colors.map((color) => ({
		value: color.value,
		format: color.format,
		line: color.position?.line,
		column: color.position?.column,
	}));

	const deduped =
		args.dedupe === true
			? values.filter(
					(color, i, all) =>
						all.findIndex((other) => other.value === color.value) === i,
				)
			: values;

	const { items, truncated } = capped(deduped, maxResults);

	return envelope(
		'extract_colors',
		{ colors: items, fileType: result.metadata?.fileType ?? languageId },
		items.length,
		toDiagnostics(result),
		truncated,
	);
}

export const TOOLS: readonly ToolDefinition[] = Object.freeze([
	Object.freeze({
		name: 'extract_colors',
		description:
			'Extract every color from a stylesheet or document, with its notation and 1-based line and column. Supports CSS, SCSS, LESS, Stylus, HTML, JavaScript, TypeScript, SVG and XML. Reports hex, rgb/rgba, hsl/hsla and named colors as written.',
		inputSchema: {
			type: 'object',
			properties: {
				content: {
					type: 'string',
					description: 'The document text to scan.',
				},
				format: {
					type: 'string',
					enum: SUPPORTED_FORMATS,
					description:
						'Document format. Provide this or `filename`. Common extensions and aliases are accepted.',
				},
				filename: {
					type: 'string',
					description:
						'Filename used to infer the format when `format` is absent, e.g. "theme.scss".',
				},
				dedupe: {
					type: 'boolean',
					default: false,
					description: 'Collapse repeated colors to their first occurrence.',
				},
				maxResults: MAX_RESULTS_SCHEMA,
			},
			required: ['content'],
			additionalProperties: false,
		},
		handler: extract,
	}),
]);
