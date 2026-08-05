import type { Color } from '../../types';
import { extractFromStylesheet } from './stylesheet';

export function extractFromCss(content: string): readonly Color[] {
	return extractFromStylesheet(content, {
		lineComments: false,
		equalsDelimiter: false,
	});
}
