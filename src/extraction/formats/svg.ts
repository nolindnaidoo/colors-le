import type { Color } from '../../types';
import { extractFromMarkup } from './markup';

/**
 * SVG's presentational color attributes, and every other XML dialect's.
 *
 * `bgcolor` is here because the `xml` language id runs this extractor, and an
 * XML document is not required to be SVG — without it, routing `xml` here
 * would have lost the one color the HTML extractor found in a
 * `<chart bgcolor="#f0a">`. Both attributes are unambiguous color carriers.
 */
const SVG_COLOR_ATTRIBUTES = [
	'fill',
	'stroke',
	'stop-color',
	'flood-color',
	'lighting-color',
	'color',
	'bgcolor',
] as const;

export function extractFromSvg(content: string): readonly Color[] {
	return extractFromMarkup(content, SVG_COLOR_ATTRIBUTES);
}
