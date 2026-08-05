import type { ColorFormat } from '../types';

/**
 * Shared color heuristics for every format extractor.
 *
 * Rules (intentional, applied uniformly):
 * - Hex: 3, 4, 6, or 8 digits (#rgb, #rgba, #rrggbb, #rrggbbaa). Other
 *   digit counts are rejected outright.
 * - Functional: legacy comma syntax rgb()/rgba()/hsl()/hsla() with
 *   whitespace (including newlines) allowed anywhere inside the call —
 *   multiline values match. Components are validated; a match with the
 *   wrong arity or missing % signs is rejected.
 * - Named: the CSS named-color keywords (plus 'transparent'), only
 *   recognized where the caller supplies value segments (declaration
 *   values, attribute values, whole string literals) — never as bare
 *   words in arbitrary prose.
 *
 * Documented limitations:
 * - Modern space-separated syntax (rgb(255 0 0 / 50%)), lab()/lch()/
 *   oklch()/color() are not extracted.
 * - currentColor/inherit and SCSS/LESS variable indirection are not
 *   colors and are intentionally ignored.
 */

export const NAMED_COLORS: ReadonlySet<string> = new Set([
	'aliceblue',
	'antiquewhite',
	'aqua',
	'aquamarine',
	'azure',
	'beige',
	'bisque',
	'black',
	'blanchedalmond',
	'blue',
	'blueviolet',
	'brown',
	'burlywood',
	'cadetblue',
	'chartreuse',
	'chocolate',
	'coral',
	'cornflowerblue',
	'cornsilk',
	'crimson',
	'cyan',
	'darkblue',
	'darkcyan',
	'darkgoldenrod',
	'darkgray',
	'darkgreen',
	'darkkhaki',
	'darkmagenta',
	'darkolivegreen',
	'darkorange',
	'darkorchid',
	'darkred',
	'darksalmon',
	'darkseagreen',
	'darkslateblue',
	'darkslategray',
	'darkturquoise',
	'darkviolet',
	'deeppink',
	'deepskyblue',
	'dimgray',
	'dodgerblue',
	'firebrick',
	'floralwhite',
	'forestgreen',
	'fuchsia',
	'gainsboro',
	'ghostwhite',
	'gold',
	'goldenrod',
	'gray',
	'green',
	'greenyellow',
	'honeydew',
	'hotpink',
	'indianred',
	'indigo',
	'ivory',
	'khaki',
	'lavender',
	'lavenderblush',
	'lawngreen',
	'lemonchiffon',
	'lightblue',
	'lightcoral',
	'lightcyan',
	'lightgoldenrodyellow',
	'lightgray',
	'lightgreen',
	'lightpink',
	'lightsalmon',
	'lightseagreen',
	'lightskyblue',
	'lightslategray',
	'lightsteelblue',
	'lightyellow',
	'lime',
	'limegreen',
	'linen',
	'magenta',
	'maroon',
	'mediumaquamarine',
	'mediumblue',
	'mediumorchid',
	'mediumpurple',
	'mediumseagreen',
	'mediumslateblue',
	'mediumspringgreen',
	'mediumturquoise',
	'mediumvioletred',
	'midnightblue',
	'mintcream',
	'mistyrose',
	'moccasin',
	'navajowhite',
	'navy',
	'oldlace',
	'olive',
	'olivedrab',
	'orange',
	'orangered',
	'orchid',
	'palegoldenrod',
	'palegreen',
	'paleturquoise',
	'palevioletred',
	'papayawhip',
	'peachpuff',
	'peru',
	'pink',
	'plum',
	'powderblue',
	'purple',
	'rebeccapurple',
	'red',
	'rosybrown',
	'royalblue',
	'saddlebrown',
	'salmon',
	'sandybrown',
	'seagreen',
	'seashell',
	'sienna',
	'silver',
	'skyblue',
	'slateblue',
	'slategray',
	'snow',
	'springgreen',
	'steelblue',
	'tan',
	'teal',
	'thistle',
	'tomato',
	'turquoise',
	'violet',
	'wheat',
	'white',
	'whitesmoke',
	'yellow',
	'yellowgreen',
	'transparent',
]);

export interface ColorMatch {
	readonly value: string;
	readonly start: number;
	readonly format: ColorFormat;
}

export interface Segment {
	readonly start: number;
	readonly end: number;
}

const HEX_RE = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;

// Loose shape first; validated component-wise below.
const FUNCTIONAL_RE = /\b(?:rgba?|hsla?)\(\s*[\d.\s,%]*?\)/gi;

const RGB_VALID = /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/;
const RGBA_VALID =
	/^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:\d*\.)?\d+\s*\)$/;
const HSL_VALID = /^hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)$/;
const HSLA_VALID =
	/^hsla\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*,\s*(?:\d*\.)?\d+\s*\)$/;

export function isNamedColor(word: string): boolean {
	return NAMED_COLORS.has(word.toLowerCase());
}

export function classifyColorFormat(value: string): ColorFormat {
	const v = value.trim().toLowerCase();
	if (v.startsWith('#')) return 'hex';
	if (v.startsWith('rgba(')) return 'rgba';
	if (v.startsWith('rgb(')) return 'rgb';
	if (v.startsWith('hsla(')) return 'hsla';
	if (v.startsWith('hsl(')) return 'hsl';
	if (isNamedColor(v)) return 'named';
	return 'unknown';
}

function isValidFunctionalColor(value: string): boolean {
	const collapsed = value.toLowerCase();
	if (collapsed.startsWith('rgba')) return RGBA_VALID.test(collapsed);
	if (collapsed.startsWith('rgb')) return RGB_VALID.test(collapsed);
	if (collapsed.startsWith('hsla')) return HSLA_VALID.test(collapsed);
	if (collapsed.startsWith('hsl')) return HSL_VALID.test(collapsed);
	return false;
}

/**
 * Hex and functional color literals anywhere in `content`, in document
 * order. Multiline functional calls are normalized to single-space
 * separators in the reported value; `start` always points at the
 * literal's first character in the original content.
 */
export function findColorLiterals(content: string): readonly ColorMatch[] {
	const matches: ColorMatch[] = [];

	HEX_RE.lastIndex = 0;
	let m = HEX_RE.exec(content);
	while (m !== null) {
		matches.push({
			value: m[0],
			start: m.index,
			format: 'hex',
		});
		m = HEX_RE.exec(content);
	}

	FUNCTIONAL_RE.lastIndex = 0;
	m = FUNCTIONAL_RE.exec(content);
	while (m !== null) {
		const raw = m[0];
		const normalized = raw
			.replace(/\s+/g, ' ')
			.replace(/\( /, '(')
			.replace(/ \)/, ')');
		if (isValidFunctionalColor(raw.replace(/\s+/g, ''))) {
			matches.push({
				value: normalized,
				start: m.index,
				format: classifyColorFormat(normalized),
			});
		}
		m = FUNCTIONAL_RE.exec(content);
	}

	return matches.sort((a, b) => a.start - b.start);
}

const WORD_RE = /[a-z]+/gi;

/**
 * Named-color keywords inside the given segments (or the whole content
 * when segments is undefined), in document order.
 */
export function findNamedColors(
	content: string,
	segments?: readonly Segment[],
): readonly ColorMatch[] {
	const spans: readonly Segment[] = segments ?? [
		{ start: 0, end: content.length },
	];
	const matches: ColorMatch[] = [];

	for (const span of spans) {
		const slice = content.slice(span.start, span.end);
		WORD_RE.lastIndex = 0;
		let m = WORD_RE.exec(slice);
		while (m !== null) {
			if (isNamedColor(m[0])) {
				matches.push({
					value: m[0],
					start: span.start + m.index,
					format: 'named',
				});
			}
			m = WORD_RE.exec(slice);
		}
	}

	return matches.sort((a, b) => a.start - b.start);
}

/**
 * Declaration-value segments: everything between ':' (or '=' when
 * `equalsDelimiter`, for Stylus) and the next ';', '{', '}', or end of
 * line. Named colors are only meaningful inside these.
 */
export function findDeclarationValueSegments(
	content: string,
	equalsDelimiter = false,
): readonly Segment[] {
	const segments: Segment[] = [];
	const delimiters = equalsDelimiter ? [':', '='] : [':'];

	for (let i = 0; i < content.length; i++) {
		const ch = content[i] as string;
		if (!delimiters.includes(ch)) continue;
		let end = i + 1;
		while (end < content.length) {
			const c = content[end] as string;
			if (c === ';' || c === '{' || c === '}' || c === '\n') break;
			end++;
		}
		if (end > i + 1) {
			segments.push({ start: i + 1, end });
		}
		i = end;
	}

	return segments;
}

export type CommentSyntax = 'css' | 'css-line' | 'js' | 'html';

/**
 * Replace comment contents with spaces (newlines preserved) so offsets
 * into the result are valid offsets into the original. String literals
 * are respected: comment markers inside quotes do not open comments.
 */
export function blankComments(content: string, syntax: CommentSyntax): string {
	if (syntax === 'html') {
		return content.replace(/<!--[\s\S]*?(?:-->|$)/g, (match) =>
			match.replace(/[^\n]/g, ' '),
		);
	}

	const allowLine = syntax === 'css-line' || syntax === 'js';
	const stringQuotes = syntax === 'js' ? '\'"`' : '\'"';
	const chars = content.split('');
	let i = 0;
	let quote: string | null = null;

	while (i < chars.length) {
		const c = chars[i] as string;

		if (quote) {
			if (c === '\\') {
				i += 2;
				continue;
			}
			if (c === quote || (c === '\n' && quote !== '`')) {
				quote = null;
			}
			i++;
			continue;
		}

		if (stringQuotes.includes(c)) {
			quote = c;
			i++;
			continue;
		}

		if (c === '/' && chars[i + 1] === '*') {
			let j = i + 2;
			while (j < chars.length) {
				if (chars[j] === '*' && chars[j + 1] === '/') {
					j += 2;
					break;
				}
				j++;
			}
			for (let k = i; k < Math.min(j, chars.length); k++) {
				if (chars[k] !== '\n') chars[k] = ' ';
			}
			i = j;
			continue;
		}

		if (allowLine && c === '/' && chars[i + 1] === '/') {
			let j = i;
			while (j < chars.length && chars[j] !== '\n') {
				chars[j] = ' ';
				j++;
			}
			i = j;
			continue;
		}

		i++;
	}

	return chars.join('');
}

/**
 * Spans of string-literal contents (quotes excluded) in JS/TS source,
 * comment-aware. Template literals are treated as plain text — good
 * enough to find color values in styled-component templates; nested
 * interpolation expressions are not re-scanned.
 */
export function findStringLiteralSpans(content: string): readonly Segment[] {
	const blanked = blankComments(content, 'js');
	const spans: Segment[] = [];
	let i = 0;
	let quote: string | null = null;
	let start = 0;

	while (i < blanked.length) {
		const c = blanked[i] as string;

		if (quote) {
			if (c === '\\') {
				i += 2;
				continue;
			}
			if (c === quote || (c === '\n' && quote !== '`')) {
				spans.push({ start, end: i });
				quote = null;
			}
			i++;
			continue;
		}

		if (c === "'" || c === '"' || c === '`') {
			quote = c;
			start = i + 1;
			i++;
			continue;
		}

		i++;
	}

	if (quote) {
		spans.push({ start, end: blanked.length });
	}

	return spans;
}
