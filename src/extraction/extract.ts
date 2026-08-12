import type { Color, ExtractionResult, FileType, ParseError } from '../types';
import { extractFromCss } from './formats/css';
import { extractFromHtml } from './formats/html';
import { extractFromJavaScript } from './formats/javascript';
import { extractFromLESS } from './formats/less';
import { extractFromSCSS } from './formats/scss';
import { extractFromStylus } from './formats/stylus';
import { extractFromSvg } from './formats/svg';
import { extractFromText } from './formats/text';

export interface ExtractionOptions {
	readonly filepath?: string;
	readonly includeMetadata?: boolean;
	readonly timeoutMs?: number;
}

export async function extractColors(
	content: string,
	languageId: string,
	options: ExtractionOptions = {},
): Promise<ExtractionResult> {
	const startTime = Date.now();
	const fileType = determineFileType(languageId);

	if (!content || content.trim().length === 0) {
		return Object.freeze({
			success: false,
			colors: Object.freeze([]),
			errors: Object.freeze([
				{
					type: 'validation-error' as const,
					message: 'Content is empty or invalid',
					filepath: options.filepath,
				},
			]),
			warnings: Object.freeze([]),
			metadata: options.includeMetadata
				? Object.freeze({
						fileType,
						totalLines: content.split('\n').length,
						processedLines: 0,
						processingTimeMs: Date.now() - startTime,
					})
				: undefined,
		});
	}

	const colors: Color[] = [];
	const errors: ParseError[] = [];
	const warnings: string[] = [];

	try {
		colors.push(...extractColorsByFileType(content, fileType));
	} catch (error) {
		errors.push({
			type: 'parse-error',
			message: error instanceof Error ? error.message : 'Unknown parsing error',
			filepath: options.filepath,
		});
	}

	const processingTime = Date.now() - startTime;
	if (options.timeoutMs && processingTime > options.timeoutMs) {
		warnings.push(
			`Processing time (${processingTime}ms) exceeded timeout (${options.timeoutMs}ms)`,
		);
	}

	const lines = content.split('\n');
	return Object.freeze({
		success: errors.length === 0,
		colors: Object.freeze(colors),
		errors: Object.freeze(errors),
		warnings: Object.freeze(warnings),
		metadata: options.includeMetadata
			? Object.freeze({
					fileType,
					totalLines: lines.length,
					processedLines: lines.length,
					processingTimeMs: Date.now() - startTime,
				})
			: undefined,
	});
}

function extractColorsByFileType(
	content: string,
	fileType: FileType,
): readonly Color[] {
	// Dispatched on the extractor name rather than the file type, so the
	// mapping the Rust CLI is held to is the mapping this actually runs.
	switch (extractorFor(fileType)) {
		case 'css':
			return extractFromCss(content);
		case 'scss':
			return extractFromSCSS(content);
		case 'less':
			return extractFromLESS(content);
		case 'stylus':
			return extractFromStylus(content);
		case 'html':
			return extractFromHtml(content);
		case 'javascript':
			return extractFromJavaScript(content);
		// `xml` runs this too, and keeps its own name: the name is user-visible
		// in every MCP answer, the extractor is not.
		case 'svg':
			return extractFromSvg(content);
		// Structured formats carry design tokens, so a bare `#250` in one is a
		// color and is read as written.
		case 'text-tokens':
			return extractFromText(content, 'counts');
		// Markdown, plain text, and every format with no extractor of its own.
		// Reading them beats refusing them — a color in a Python constant is
		// still a color — but a short all-digit hex here is an issue reference
		// far more often than a color, so it has to carry an a-f.
		default:
			return extractFromText(content, 'needs-a-letter');
	}
}

/**
 * Which extractor a resolved format runs, by name.
 *
 * Named rather than left inline above, because the Rust CLI makes this same
 * choice in `format::extractor_of` and two copies of a mapping drift. This one
 * already did: `xml` ran the markup-SVG extractor here and the markup-HTML one
 * there, so `<rect fill="#1a2b3c"/>` was found here and **missed** by the CLI —
 * a shared MCP tool giving two answers, in the under-reporting direction.
 * `crate/fixtures/aliases.json` holds both sides to this table now; the alias
 * check could not see it, because the divergence is a layer below the alias.
 *
 * The names are the extractor families, not the formats.
 */
export function extractorFor(format: string): string {
	switch (determineFileType(format)) {
		case 'css':
			return 'css';
		case 'scss':
			return 'scss';
		case 'less':
			return 'less';
		case 'stylus':
			return 'stylus';
		case 'html':
			return 'html';
		case 'javascript':
		case 'typescript':
			return 'javascript';
		case 'svg':
			return 'svg';
		case 'json':
		case 'yaml':
		case 'toml':
			return 'text-tokens';
		default:
			return 'text-prose';
	}
}

/**
 * The VS Code language id, as a format this reads.
 *
 * Anything absent is `unknown`, which is read rather than refused: `unknown`
 * names how much the engine knew about the document, not whether it opened it.
 */
function determineFileType(languageId: string): FileType {
	switch (languageId) {
		case 'css':
			return 'css';
		case 'scss':
			return 'scss';
		case 'less':
			return 'less';
		case 'stylus':
			return 'stylus';
		case 'html':
			return 'html';
		case 'javascript':
		case 'javascriptreact':
			return 'javascript';
		case 'typescript':
		case 'typescriptreact':
			return 'typescript';
		case 'xml':
		case 'svg':
			return 'svg';
		case 'json':
		case 'jsonc':
			return 'json';
		case 'yaml':
			return 'yaml';
		case 'toml':
			return 'toml';
		case 'markdown':
			return 'markdown';
		case 'plaintext':
			return 'plaintext';
		default:
			return 'unknown';
	}
}
