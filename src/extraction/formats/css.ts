import type { Color } from '../../types';
import { detectColorFormat } from '../../utils/colorConversion';

// Regex patterns for different color formats
const HEX_PATTERN = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const RGB_PATTERN = /rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
const RGBA_PATTERN =
	/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g;
const HSL_PATTERN = /hsl\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/g;
const HSLA_PATTERN =
	/hsla\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*([\d.]+)\s*\)/g;

export function extractFromCss(content: string): Color[] {
	const colors: Color[] = [];
	const lines = content.split('\n');

	// Helper function to check if position is inside a CSS comment
	const isInComment = (line: string, index: number): boolean => {
		const before = line.substring(0, index);
		const commentStart = before.lastIndexOf('/*');
		const commentEnd = before.lastIndexOf('*/');
		return commentStart > commentEnd;
	};

	lines.forEach((line, lineIndex) => {
		try {
			// Extract hex colors - reset regex lastIndex to prevent race conditions
			HEX_PATTERN.lastIndex = 0;
			let match;
			while ((match = HEX_PATTERN.exec(line)) !== null) {
				if (!isInComment(line, match.index ?? 0)) {
					colors.push({
						value: match[0],
						format: detectColorFormat(match[0]),
						position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
						context: line.trim(),
					});
				}
			}

			// Extract RGB colors - reset regex lastIndex
			RGB_PATTERN.lastIndex = 0;
			while ((match = RGB_PATTERN.exec(line)) !== null) {
				if (!isInComment(line, match.index ?? 0)) {
					colors.push({
						value: match[0],
						format: detectColorFormat(match[0]),
						position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
						context: line.trim(),
					});
				}
			}

			// Extract RGBA colors - reset regex lastIndex
			RGBA_PATTERN.lastIndex = 0;
			while ((match = RGBA_PATTERN.exec(line)) !== null) {
				if (!isInComment(line, match.index ?? 0)) {
					colors.push({
						value: match[0],
						format: detectColorFormat(match[0]),
						position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
						context: line.trim(),
					});
				}
			}

			// Extract HSL colors - reset regex lastIndex
			HSL_PATTERN.lastIndex = 0;
			while ((match = HSL_PATTERN.exec(line)) !== null) {
				if (!isInComment(line, match.index ?? 0)) {
					colors.push({
						value: match[0],
						format: detectColorFormat(match[0]),
						position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
						context: line.trim(),
					});
				}
			}

			// Extract HSLA colors - reset regex lastIndex
			HSLA_PATTERN.lastIndex = 0;
			while ((match = HSLA_PATTERN.exec(line)) !== null) {
				if (!isInComment(line, match.index ?? 0)) {
					colors.push({
						value: match[0],
						format: detectColorFormat(match[0]),
						position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
						context: line.trim(),
					});
				}
			}
		} catch (error) {
			// Skip lines that cause regex errors to prevent crashes
			console.warn(`[Colors-LE] Regex error on line ${lineIndex + 1}:`, error);
		}
	});

	return colors;
}
