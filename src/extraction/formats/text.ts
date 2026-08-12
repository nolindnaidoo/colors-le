import type { Color } from '../../types';
import {
	type ColorMatch,
	findColorLiterals,
	findColorLiteralsInProse,
	findDeclarationValueSegments,
	isNamedColor,
	type Segment,
} from '../heuristics';
import { toColors } from './stylesheet';

/** Whether a bare `#250` in this document is a color. */
export type ShortHex =
	/** It is. The document has a syntax where a color belongs — JSON, YAML and
	 * TOML carry design tokens, and `#250` is a valid one. */
	| 'counts'
	/** It is not, unless it contains an a-f. Prose, and anything with no
	 * extractor of its own. */
	| 'needs-a-letter';

/**
 * Everything else: a raw scan of the whole document.
 *
 * Reading a file this has no parser for beats refusing it — design tokens live
 * in JSON, and a color in a Python constant is still a color.
 *
 * Comments are not blanked, because there is no syntax to blank them in. A hex
 * in a `#` comment is reported, which is the honest answer for a document
 * whose language is unknown.
 */
export function extractFromText(
	content: string,
	shortHex: ShortHex,
): readonly Color[] {
	const literals: readonly ColorMatch[] =
		shortHex === 'counts'
			? findColorLiterals(content)
			: findColorLiteralsInProse(content);
	// '=' as well as ':', because this one extractor covers TOML, INI and
	// source as well as prose.
	const named = findDeclarationValueSegments(content, true)
		.map((segment) => namedValue(content, segment))
		.filter((match): match is ColorMatch => match !== undefined);

	return toColors(content, [...literals, ...named]);
}

/**
 * The named color a declaration value **is**, rather than one it mentions.
 *
 * The whole-value rule, the same one markup applies to an attribute and
 * JavaScript applies to a string literal — and the one that makes this
 * extractor usable on prose. Measured on two real repositories: taking every
 * named keyword inside a declaration value turned a paragraph reading
 * "brand-orange focus ring", a shields.io badge ending `-red)`, and a Tailwind
 * `className="… text-white …"` into findings, 35 of them against 19 real
 * colors. Requiring the value to be the color drops all 35 and keeps
 * `"paper": "white"`.
 *
 * Quotes and a trailing comma are stripped first, because a value in JSON,
 * YAML, TOML or source arrives wearing them.
 */
function namedValue(content: string, segment: Segment): ColorMatch | undefined {
	const slice = content.slice(segment.start, segment.end);
	const trimmed = slice
		.trim()
		.replace(/[,;]+$/, '')
		.trim()
		.replace(/^["'`]+|["'`]+$/g, '')
		.trim();
	if (!isNamedColor(trimmed)) return undefined;

	// The position is the color's, not the value's: a reader opening the file
	// has to land on the word.
	const offset = slice.indexOf(trimmed);
	if (offset < 0) return undefined;
	return { value: trimmed, start: segment.start + offset, format: 'named' };
}
