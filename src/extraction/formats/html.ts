import type { Color } from '../../types';
import { extractFromMarkup } from './markup';

const HTML_COLOR_ATTRIBUTES = ['bgcolor', 'color'] as const;

export function extractFromHtml(content: string): readonly Color[] {
	return extractFromMarkup(content, HTML_COLOR_ATTRIBUTES);
}
