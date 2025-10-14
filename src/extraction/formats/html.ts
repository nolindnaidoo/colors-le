import type { Color } from '../../types';
import { detectColorFormat } from '../../utils/colorConversion';

// Regex patterns for different color formats in HTML
const HEX_PATTERN = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const RGB_PATTERN = /rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
const RGBA_PATTERN =
	/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g;
const HSL_PATTERN = /hsl\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/g;
const HSLA_PATTERN =
	/hsla\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*([\d.]+)\s*\)/g;

export function extractFromHtml(content: string): Color[] {
	const colors: Color[] = [];
	const lines = content.split('\n');

	// Helper function to check if position is inside an HTML comment
	const _isInComment = (line: string, index: number): boolean => {
		const before = line.substring(0, index);
		const commentStart = before.lastIndexOf('<!--');
		const commentEnd = before.lastIndexOf('-->');
		return commentStart > commentEnd;
	};

	lines.forEach((line, lineIndex) => {
		try {
			// Skip lines that are comments
			if (line.trim().startsWith('<!--')) {
				return;
			}

			// Extract colors from style attributes first
			const styleAttrMatch = line.match(/style\s*=\s*["']([^"']+)["']/gi);
			if (styleAttrMatch) {
				for (const match of styleAttrMatch) {
					const styleContent = match.match(/["']([^"']+)["']/)?.[1];
					if (styleContent) {
						extractColorsFromStyleContent(
							styleContent,
							lineIndex + 1,
							colors,
							line.trim(),
						);
					}
				}
			}

			// Extract colors from <style> tags
			if (line.includes('<style') || line.includes('</style>')) {
				// For simplicity, extract colors from the entire line
				// In a more sophisticated implementation, you'd track style tag boundaries
				extractColorsFromStyleContent(line, lineIndex + 1, colors, line.trim());
			}

			// Extract hex colors - reset regex lastIndex to prevent race conditions
			HEX_PATTERN.lastIndex = 0;
			let match;
			while ((match = HEX_PATTERN.exec(line)) !== null) {
				if (isHtmlStyleContext(line, match.index ?? 0)) {
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
				if (isHtmlStyleContext(line, match.index ?? 0)) {
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
				if (isHtmlStyleContext(line, match.index ?? 0)) {
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
				if (isHtmlStyleContext(line, match.index ?? 0)) {
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
				if (isHtmlStyleContext(line, match.index ?? 0)) {
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

	// Deduplicate colors by value and line number
	// This prevents extracting the same color twice when it appears in both style attribute and regex matches
	const uniqueColors = Array.from(
		new Map(
			colors.map((c) => [`${c.value}-${c.position?.line ?? 0}`, c]),
		).values(),
	);

	return uniqueColors;
}

function extractColorsFromStyleContent(
	styleContent: string,
	lineNumber: number,
	colors: Color[],
	context: string,
): void {
	// Extract hex colors from style content
	HEX_PATTERN.lastIndex = 0;
	let match;
	while ((match = HEX_PATTERN.exec(styleContent)) !== null) {
		colors.push({
			value: match[0],
			format: detectColorFormat(match[0]),
			position: { line: lineNumber, column: (match.index ?? 0) + 1 },
			context,
		});
	}

	// Extract RGB colors from style content
	RGB_PATTERN.lastIndex = 0;
	while ((match = RGB_PATTERN.exec(styleContent)) !== null) {
		colors.push({
			value: match[0],
			format: detectColorFormat(match[0]),
			position: { line: lineNumber, column: (match.index ?? 0) + 1 },
			context,
		});
	}

	// Extract RGBA colors from style content
	RGBA_PATTERN.lastIndex = 0;
	while ((match = RGBA_PATTERN.exec(styleContent)) !== null) {
		colors.push({
			value: match[0],
			format: detectColorFormat(match[0]),
			position: { line: lineNumber, column: (match.index ?? 0) + 1 },
			context,
		});
	}

	// Extract HSL colors from style content
	HSL_PATTERN.lastIndex = 0;
	while ((match = HSL_PATTERN.exec(styleContent)) !== null) {
		colors.push({
			value: match[0],
			format: detectColorFormat(match[0]),
			position: { line: lineNumber, column: (match.index ?? 0) + 1 },
			context,
		});
	}

	// Extract HSLA colors from style content
	HSLA_PATTERN.lastIndex = 0;
	while ((match = HSLA_PATTERN.exec(styleContent)) !== null) {
		colors.push({
			value: match[0],
			format: detectColorFormat(match[0]),
			position: { line: lineNumber, column: (match.index ?? 0) + 1 },
			context,
		});
	}
}

function isHtmlStyleContext(line: string, matchIndex: number): boolean {
	const trimmedLine = line.trim();

	// Skip HTML comments
	if (trimmedLine.startsWith('<!--') || trimmedLine.includes('<!--')) {
		return false;
	}

	// Check if we're inside a style attribute
	const beforeMatch = line.substring(0, matchIndex);
	const styleAttrPattern = /style\s*=\s*["'][^"']*$/;
	if (styleAttrPattern.test(beforeMatch)) {
		return true;
	}

	// Check if we're inside a <style> tag
	const styleTagPattern = /<style[^>]*>/;
	if (styleTagPattern.test(line)) {
		return true;
	}

	// Check for CSS property patterns
	const cssPropertyPattern =
		/(color|background|border|fill|stroke|box-shadow|text-shadow)\s*:\s*[^;]*$/;
	if (cssPropertyPattern.test(beforeMatch)) {
		return true;
	}

	// Default to false for safety - only extract from clear style contexts
	return false;
}
