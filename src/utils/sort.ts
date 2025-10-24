import type { SortMode } from '../types';
import { parseColor, rgbToHsl } from './colorConversion';

export function sortColors(lines: string[], sortMode: SortMode): string[] {
	if (sortMode === 'off') {
		return [...lines];
	}

	const filteredLines = lines.filter((line) => line.trim().length > 0);

	switch (sortMode) {
		case 'hex-asc':
			return filteredLines.sort((a, b) => a.localeCompare(b));
		case 'hex-desc':
			return filteredLines.sort((a, b) => b.localeCompare(a));
		case 'hue-asc':
			return sortByHue(filteredLines, 'asc');
		case 'hue-desc':
			return sortByHue(filteredLines, 'desc');
		case 'saturation-asc':
			return sortBySaturation(filteredLines, 'asc');
		case 'saturation-desc':
			return sortBySaturation(filteredLines, 'desc');
		case 'lightness-asc':
			return sortByLightness(filteredLines, 'asc');
		case 'lightness-desc':
			return sortByLightness(filteredLines, 'desc');
		default:
			return filteredLines;
	}
}

function sortByHue(lines: string[], direction: 'asc' | 'desc'): string[] {
	return lines.sort((a, b) => {
		const hueA = extractHue(a);
		const hueB = extractHue(b);
		return direction === 'asc' ? hueA - hueB : hueB - hueA;
	});
}

function sortBySaturation(
	lines: string[],
	direction: 'asc' | 'desc',
): string[] {
	return lines.sort((a, b) => {
		const satA = extractSaturation(a);
		const satB = extractSaturation(b);
		return direction === 'asc' ? satA - satB : satB - satA;
	});
}

function sortByLightness(lines: string[], direction: 'asc' | 'desc'): string[] {
	return lines.sort((a, b) => {
		const lightA = extractLightness(a);
		const lightB = extractLightness(b);
		return direction === 'asc' ? lightA - lightB : lightB - lightA;
	});
}

function extractHue(color: string): number {
	const rgb = parseColor(color);
	if (!rgb) return 0;

	const hsl = rgbToHsl(rgb);
	return hsl.h;
}

function extractSaturation(color: string): number {
	const rgb = parseColor(color);
	if (!rgb) return 0;

	const hsl = rgbToHsl(rgb);
	return hsl.s;
}

function extractLightness(color: string): number {
	const rgb = parseColor(color);
	if (!rgb) return 0;

	const hsl = rgbToHsl(rgb);
	return hsl.l;
}
