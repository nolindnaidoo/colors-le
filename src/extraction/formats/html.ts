import type { Color } from '../../types';
import { extractFromMarkup, MARKUP_COLOR_ATTRIBUTES } from './markup';

/**
 * **HTML reads the SVG attributes too, because HTML carries SVG.**
 *
 * An inline `<svg>` icon is ordinary in a modern page, and reading HTML
 * with only `bgcolor` and `color` lost every `fill` and `stroke` in one —
 * silently, with no diagnostic. That pair was a subset of the shared
 * list, so this widens what HTML finds and takes nothing away.
 */
export function extractFromHtml(content: string): readonly Color[] {
	return extractFromMarkup(content, MARKUP_COLOR_ATTRIBUTES);
}
