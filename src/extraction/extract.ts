import type { Color, ExtractionResult, FileType, ParseError } from '../types';
import { extractFromCss } from './formats/css';
import { extractFromHtml } from './formats/html';
import { extractFromJavaScript } from './formats/javascript';
import { extractFromLESS } from './formats/less';
import { extractFromSCSS } from './formats/scss';
import { extractFromStylus } from './formats/stylus';
import { extractFromSvg } from './formats/svg';

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
	switch (fileType) {
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
		case 'typescript':
			return extractFromJavaScript(content);
		case 'svg':
			return extractFromSvg(content);
		default:
			// Unknown types fall back to CSS-style extraction: hex/functional
			// literals are format-agnostic enough to be useful anywhere.
			return extractFromCss(content);
	}
}

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
		default:
			return 'unknown';
	}
}
