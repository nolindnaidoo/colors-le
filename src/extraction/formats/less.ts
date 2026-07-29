import type { Color } from '../../types';
import { extractFromStylesheet } from './stylesheet';

export function extractFromLESS(content: string): readonly Color[] {
	return extractFromStylesheet(content, {
		lineComments: true,
		equalsDelimiter: false,
	});
}
