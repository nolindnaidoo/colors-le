import type { Color } from '../../types';
import {
	type ColorMatch,
	findColorLiterals,
	findStringLiteralSpans,
	isNamedColor,
} from '../heuristics';
import { toColors } from './stylesheet';

/**
 * JS/TS extractor: colors live in string and template literals only —
 * hex/functional literals anywhere inside a string (styled-component
 * templates included), named colors only when the whole string is the
 * color. Code outside strings (identifiers, comments) never matches.
 */
export function extractFromJavaScript(content: string): readonly Color[] {
	const spans = findStringLiteralSpans(content);
	const matches: ColorMatch[] = [];

	for (const span of spans) {
		const slice = content.slice(span.start, span.end);

		for (const match of findColorLiterals(slice)) {
			matches.push({ ...match, start: span.start + match.start });
		}

		const trimmed = slice.trim();
		if (isNamedColor(trimmed)) {
			matches.push({
				value: trimmed,
				start: span.start + slice.indexOf(trimmed),
				format: 'named',
			});
		}
	}

	return toColors(content, matches);
}
