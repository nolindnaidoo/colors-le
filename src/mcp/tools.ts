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
 *
 * **The description is the API.** A model reads it to decide whether to call
 * this tool at all, so it states plainly what the tool handles rather than
 * gesturing at "many formats" — a model cannot reason about a vague claim, and
 * the cost is either a call that returns nothing or a tool never tried. The
 * same reasoning governs argument descriptions: each says what the value does,
 * not what type it is, because the type is already in the schema.
 */

// Advertised in the schema with its default visible, rather than silently
// enforced. A model that can see the cap can raise it when it genuinely needs
// more, and can read `meta.truncated` to know it should. A hidden cap just
// produces quietly incomplete answers.
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

	// Never a refusal. An agent that knows nothing about a document still gets
	// the colors in it, which is the whole reason a format is optional — and
	// `data.fileType` says whether that answer came from a parser or a scan.
	const languageId = resolveFormat(format, filename);

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
			'Extract every color from a stylesheet or document, with its notation and 1-based line and column. Reads CSS, SCSS, LESS, Stylus, HTML, JavaScript, TypeScript, SVG, XML, JSON, YAML, TOML, Markdown and plain text by name, and anything else as raw text, so a format is optional. Reports hex, rgb/rgba, hsl/hsla and named colors as written.',
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
						'Document format. Optional — an unrecognised or absent format is read as raw text and reported as "unknown".',
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
