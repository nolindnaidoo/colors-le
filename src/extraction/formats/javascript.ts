import type { Color } from '../../types';
import { detectColorFormat, parseColor } from '../../utils/colorConversion';

// Regex patterns for different color formats in JavaScript/TypeScript
const HEX_PATTERN = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const RGB_PATTERN = /rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
const RGBA_PATTERN =
	/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g;
const HSL_PATTERN = /hsl\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/g;
const HSLA_PATTERN =
	/hsla\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*([\d.]+)\s*\)/g;

// String patterns for color values in quotes
const STRING_COLOR_PATTERN = /['"`]([^'"`]*?)['"`]/g;

export function extractFromJavaScript(content: string): Color[] {
	const colors: Color[] = [];
	const lines = content.split('\n');

	lines.forEach((line, lineIndex) => {
		// Extract hex colors
		let match;
		while ((match = HEX_PATTERN.exec(line)) !== null) {
			if (isStyleContext(line, match.index ?? 0)) {
				colors.push({
					value: match[0],
					format: detectColorFormat(match[0]),
					position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
					context: line.trim(),
				});
			}
		}

		// Extract RGB colors
		while ((match = RGB_PATTERN.exec(line)) !== null) {
			if (isStyleContext(line, match.index ?? 0)) {
				colors.push({
					value: match[0],
					format: detectColorFormat(match[0]),
					position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
					context: line.trim(),
				});
			}
		}

		// Extract RGBA colors
		while ((match = RGBA_PATTERN.exec(line)) !== null) {
			if (isStyleContext(line, match.index ?? 0)) {
				colors.push({
					value: match[0],
					format: detectColorFormat(match[0]),
					position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
					context: line.trim(),
				});
			}
		}

		// Extract HSL colors
		while ((match = HSL_PATTERN.exec(line)) !== null) {
			if (isStyleContext(line, match.index ?? 0)) {
				colors.push({
					value: match[0],
					format: detectColorFormat(match[0]),
					position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
					context: line.trim(),
				});
			}
		}

		// Extract HSLA colors
		while ((match = HSLA_PATTERN.exec(line)) !== null) {
			if (isStyleContext(line, match.index ?? 0)) {
				colors.push({
					value: match[0],
					format: detectColorFormat(match[0]),
					position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
					context: line.trim(),
				});
			}
		}

		// Extract colors from string literals
		while ((match = STRING_COLOR_PATTERN.exec(line)) !== null) {
			const stringValue = match[1];
			if (
				stringValue &&
				isValidColor(stringValue) &&
				isStyleContext(line, match.index ?? 0)
			) {
				colors.push({
					value: stringValue,
					format: detectColorFormat(stringValue),
					position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
					context: line.trim(),
				});
			}
		}
	});

	// Deduplicate colors by value and line number
	// This prevents extracting the same color twice when it appears in both regex and string literal matches
	const uniqueColors = Array.from(
		new Map(
			colors.map((c) => [`${c.value}-${c.position?.line ?? 0}`, c]),
		).values(),
	);

	return uniqueColors;
}

function isValidColor(value: string): boolean {
	return parseColor(value) !== null;
}

function isStyleContext(line: string, matchIndex: number): boolean {
	const trimmedLine = line.trim();

	// Skip comments - check if the match is within a comment
	const beforeMatch = line.substring(0, matchIndex);

	// Check for single-line comments
	if (beforeMatch.includes('//')) {
		return false;
	}

	// Check for multi-line comments
	const commentStart = beforeMatch.lastIndexOf('/*');
	const commentEnd = beforeMatch.lastIndexOf('*/');
	if (commentStart > commentEnd) {
		return false;
	}

	// Skip lines that start with comments
	if (
		trimmedLine.startsWith('//') ||
		trimmedLine.startsWith('/*') ||
		trimmedLine.startsWith('*')
	) {
		return false;
	}

	// Look for style-related keywords and patterns
	const styleKeywords = [
		'color:',
		'background:',
		'border:',
		'box-shadow:',
		'text-shadow:',
		'fill:',
		'stroke:',
		'theme:',
		'palette:',
		'style:',
		'styles:',
		'colors:',
		'backgroundColor:',
		'borderColor:',
		'textColor:',
		'fillColor:',
		'strokeColor:',
		'colorScheme:',
		'css:',
		'styled',
		'theme',
	];

	// Check if line contains style-related keywords
	const hasStyleKeyword = styleKeywords.some((keyword) =>
		line.toLowerCase().includes(keyword.toLowerCase()),
	);

	if (hasStyleKeyword) {
		return true;
	}

	// Check for CSS-in-JS patterns
	const cssInJsPatterns = [
		/css`/,
		/styled\./,
		/createStyles/,
		/makeStyles/,
		/useStyles/,
		/emotion/,
		/styled-components/,
		/theme\./,
		/colors\./,
	];

	const hasCssInJs = cssInJsPatterns.some((pattern) => pattern.test(line));
	if (hasCssInJs) {
		return true;
	}

	// Check for object property patterns that might be style objects
	// Look for patterns like: { color: '#fff', backgroundColor: '#000' }
	const beforeMatchObj = line.substring(0, matchIndex);
	const _afterMatch = line.substring(matchIndex);

	// Check if we're inside an object literal with style-like properties
	const objectPattern = /{[^}]*$/;
	const stylePropertyPattern =
		/(color|background|border|fill|stroke|theme|palette|style|colors)\s*:/;

	if (objectPattern.test(beforeMatchObj) && stylePropertyPattern.test(line)) {
		return true;
	}

	// Check for assignment to style-related variables
	const styleVarPattern =
		/(const|let|var)\s+(color|style|theme|palette|css)\w*\s*=/;
	if (styleVarPattern.test(line)) {
		return true;
	}

	// Check for nested theme/color objects by looking at the entire line context
	// This handles cases like theme.colors.primary or colors: { primary: '#ff0000' }
	const themeContextPattern = /(theme|colors|palette|style)\s*[.:]/;
	if (themeContextPattern.test(line)) {
		return true;
	}

	// Default to false for safety - only extract from clear style contexts
	return false;
}
