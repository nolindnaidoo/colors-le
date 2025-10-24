import type { Color } from '../../types';
import { detectColorFormat } from '../../utils/colorConversion';

// Regex patterns for different color formats in SVG
const HEX_PATTERN = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
const RGB_PATTERN = /rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g;
const RGBA_PATTERN =
	/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/g;
const HSL_PATTERN = /hsl\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/g;
const HSLA_PATTERN =
	/hsla\s*\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*([\d.]+)\s*\)/g;

// SVG-specific color attributes
const SVG_COLOR_ATTRIBUTES =
	/(?:fill|stroke|stop-color|flood-color|lighting-color|color)=["']([^"']+)["']/gi;

/**
 * Extract colors from SVG files
 * SVG colors can appear in:
 * - fill, stroke, stop-color, flood-color, lighting-color, color attributes
 * - style attributes (inline CSS)
 * - <style> elements (CSS blocks)
 * - Gradients and patterns
 */
export function extractFromSvg(content: string): Color[] {
	const colors: Color[] = [];
	const lines = content.split('\n');

	lines.forEach((line, lineIndex) => {
		try {
			// Skip XML comments
			if (line.trim().startsWith('<!--')) {
				return;
			}

			// Extract colors from SVG color attributes (fill, stroke, stop-color, etc.)
			SVG_COLOR_ATTRIBUTES.lastIndex = 0;
			let attrMatch;
			while ((attrMatch = SVG_COLOR_ATTRIBUTES.exec(line)) !== null) {
				const colorValue = attrMatch[1];
				if (colorValue && isValidColor(colorValue)) {
					colors.push({
						value: colorValue,
						format: detectColorFormat(colorValue),
						position: {
							line: lineIndex + 1,
							column: (attrMatch.index ?? 0) + 1,
						},
						context: line.trim(),
					});
				}
			}

			// Extract colors from style attributes
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
				extractColorsFromStyleContent(line, lineIndex + 1, colors, line.trim());
			}

			// Extract hex colors from text content - reset regex lastIndex
			HEX_PATTERN.lastIndex = 0;
			let match;
			while ((match = HEX_PATTERN.exec(line)) !== null) {
				colors.push({
					value: match[0],
					format: detectColorFormat(match[0]),
					position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
					context: line.trim(),
				});
			}

			// Extract RGB colors - reset regex lastIndex
			RGB_PATTERN.lastIndex = 0;
			while ((match = RGB_PATTERN.exec(line)) !== null) {
				colors.push({
					value: match[0],
					format: detectColorFormat(match[0]),
					position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
					context: line.trim(),
				});
			}

			// Extract RGBA colors - reset regex lastIndex
			RGBA_PATTERN.lastIndex = 0;
			while ((match = RGBA_PATTERN.exec(line)) !== null) {
				colors.push({
					value: match[0],
					format: detectColorFormat(match[0]),
					position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
					context: line.trim(),
				});
			}

			// Extract HSL colors - reset regex lastIndex
			HSL_PATTERN.lastIndex = 0;
			while ((match = HSL_PATTERN.exec(line)) !== null) {
				colors.push({
					value: match[0],
					format: detectColorFormat(match[0]),
					position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
					context: line.trim(),
				});
			}

			// Extract HSLA colors - reset regex lastIndex
			HSLA_PATTERN.lastIndex = 0;
			while ((match = HSLA_PATTERN.exec(line)) !== null) {
				colors.push({
					value: match[0],
					format: detectColorFormat(match[0]),
					position: { line: lineIndex + 1, column: (match.index ?? 0) + 1 },
					context: line.trim(),
				});
			}
		} catch (error) {
			// Skip lines that cause regex errors to prevent crashes
			console.warn(`[Colors-LE] Regex error on line ${lineIndex + 1}:`, error);
		}
	});

	// Deduplicate colors by value and line number
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

function isValidColor(value: string): boolean {
	// Check if it's a hex color
	if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
		return true;
	}

	// Check if it's a named color (common SVG colors)
	const namedColors = [
		'none',
		'transparent',
		'currentColor',
		'black',
		'white',
		'red',
		'green',
		'blue',
		'yellow',
		'cyan',
		'magenta',
		'gray',
		'grey',
		'orange',
		'purple',
		'pink',
		'brown',
	];
	if (namedColors.includes(value.toLowerCase())) {
		return true;
	}

	// Check if it's an rgb/rgba/hsl/hsla color
	if (
		/^rgb/.test(value) ||
		/^hsl/.test(value) ||
		value.startsWith('url(') ||
		value.startsWith('inherit')
	) {
		return true;
	}

	return false;
}
