import * as nls from 'vscode-nls';
import { getConfiguration } from '../config/config';
import type { Color, ExtractionResult, FileType, ParseError } from '../types';
import { createEnhancedError } from '../utils/errorHandling';
import {
	createPerformanceTracker,
	shouldCancelBasedOnPerformance,
} from '../utils/performance';
import { extractFromCss } from './formats/css';
import { extractFromHtml } from './formats/html';
import { extractFromJavaScript } from './formats/javascript';
import { extractFromLESS } from './formats/less';
import { extractFromSCSS } from './formats/scss';
import { extractFromStylus } from './formats/stylus';
import { extractFromSvg } from './formats/svg';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export interface ExtractionOptions {
	readonly filepath?: string;
	readonly showProgress?: boolean;
	readonly includeMetadata?: boolean;
	readonly maxColors?: number;
	readonly timeoutMs?: number;
	readonly enablePerformanceMonitoring?: boolean;
}

export async function extractColors(
	content: string,
	languageId: string,
	options: ExtractionOptions = {},
): Promise<ExtractionResult> {
	const startTime = Date.now();
	const fileType = determineFileType(languageId);
	const colors: Color[] = [];
	const errors: ParseError[] = [];
	const warnings: string[] = [];

	// Initialize performance monitoring if enabled
	const performanceTracker = options.enablePerformanceMonitoring
		? createPerformanceTracker(getConfiguration())
		: null;
	if (performanceTracker) {
		performanceTracker.start('extract-colors', content.length);
	}

	// Validate input
	if (!content || content.trim().length === 0) {
		const error = createEnhancedError(
			new Error(
				localize(
					'runtime.extraction.empty-content',
					'Content is empty or invalid',
				),
			),
			'validation',
			{ contentLength: content.length },
			{
				recoverable: false,
				severity: 'low',
			},
		);

		const metrics = performanceTracker?.end(0, 0, 0, 1);

		return {
			success: false,
			colors: Object.freeze([]),
			errors: Object.freeze([
				{
					type: 'validation-error',
					message: error.userMessage,
					filepath: options.filepath,
				},
			]),
			warnings: Object.freeze([]),
			metadata: options.includeMetadata
				? {
						fileType,
						totalLines: content.split('\n').length,
						processedLines: 0,
						processingTimeMs: Date.now() - startTime,
						performanceMetrics: metrics || undefined,
					}
				: undefined,
		};
	}

	const lines = content.split('\n');
	let processedLines = 0;

	try {
		// Check for cancellation before starting extraction
		if (
			shouldCancelBasedOnPerformance(startTime, 0, options.timeoutMs || 30000)
		) {
			warnings.push(
				localize(
					'runtime.extraction.cancelled',
					'Operation cancelled due to performance constraints',
				),
			);
			throw new Error('Operation cancelled');
		}

		// Extract colors based on file type
		switch (fileType) {
			case 'css':
				colors.push(...extractFromCss(content));
				break;
			case 'scss':
				colors.push(...extractFromSCSS(content));
				break;
			case 'less':
				colors.push(...extractFromLESS(content));
				break;
			case 'stylus':
				colors.push(...extractFromStylus(content));
				break;
			case 'html':
				colors.push(...extractFromHtml(content));
				break;
			case 'javascript':
			case 'typescript':
				colors.push(...extractFromJavaScript(content));
				break;
			case 'svg':
				colors.push(...extractFromSvg(content));
				break;
			default:
				// Try CSS extraction as fallback
				warnings.push(
					localize(
						'runtime.extraction.fallback',
						'Unknown file type "{0}", using CSS extraction as fallback',
						languageId,
					),
				);
				colors.push(...extractFromCss(content));
				break;
		}

		processedLines = lines.length;

		// Check for color count limits
		if (options.maxColors && colors.length > options.maxColors) {
			warnings.push(
				localize(
					'runtime.extraction.color-limit',
					'Color count ({0}) exceeds limit ({1}), truncating results',
					colors.length,
					options.maxColors,
				),
			);
			// Create new array instead of mutating original to prevent memory leaks
			colors.splice(0, colors.length, ...colors.slice(0, options.maxColors));
		}

		// Check for timeout
		const processingTime = Date.now() - startTime;
		if (options.timeoutMs && processingTime > options.timeoutMs) {
			warnings.push(
				localize(
					'runtime.extraction.timeout',
					'Processing time ({0}ms) exceeded timeout ({1}ms)',
					processingTime,
					options.timeoutMs,
				),
			);
		}

		// Check for performance cancellation during processing
		if (
			shouldCancelBasedOnPerformance(
				startTime,
				colors.length,
				options.timeoutMs || 30000,
			)
		) {
			warnings.push(
				localize(
					'runtime.extraction.performance-cancelled',
					'Operation cancelled due to performance limits',
				),
			);
		}
	} catch (error) {
		const enhancedError =
			error instanceof Error
				? createEnhancedError(
						error,
						'parse',
						{
							fileType,
							contentLength: content.length,
							languageId,
						},
						{
							recoverable: true,
							severity: 'medium',
							suggestion: localize(
								'runtime.extraction.parse-error.suggestion',
								'Try checking file syntax or using a different file format',
							),
						},
					)
				: createEnhancedError(
						new Error(
							localize(
								'runtime.extraction.unknown-error',
								'Unknown parsing error',
							),
						),
						'parse',
						{ fileType, languageId },
						{
							recoverable: true,
							severity: 'medium',
						},
					);

		errors.push({
			type: 'parse-error',
			message: enhancedError.userMessage,
			filepath: options.filepath,
		});
	}

	// End performance monitoring
	const metrics = performanceTracker?.end(
		colors.length,
		colors.length,
		warnings.length,
		errors.length,
	);

	return Object.freeze({
		success: errors.length === 0,
		colors: Object.freeze(colors),
		errors: Object.freeze(errors),
		warnings: Object.freeze(warnings),
		metadata: options.includeMetadata
			? Object.freeze({
					fileType,
					totalLines: lines.length,
					processedLines,
					processingTimeMs: Date.now() - startTime,
					performanceMetrics: metrics || undefined,
				})
			: undefined,
	});
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
			return 'javascript';
		case 'typescript':
			return 'typescript';
		case 'xml':
		case 'svg':
			return 'svg';
		default:
			return 'unknown';
	}
}
