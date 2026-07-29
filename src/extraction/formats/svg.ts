import type { Color } from '../../types';
import { extractFromMarkup } from './markup';

const SVG_COLOR_ATTRIBUTES = [
	'fill',
	'stroke',
	'stop-color',
	'flood-color',
	'lighting-color',
	'color',
] as const;

export function extractFromSvg(content: string): Color[] {
	return extractFromMarkup(content, SVG_COLOR_ATTRIBUTES);
}
