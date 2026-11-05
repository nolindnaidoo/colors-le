import type { Color } from '../../types';
import {
	blankComments,
	type ColorMatch,
	classifyColorFormat,
	findColorLiterals,
	findDeclarationValueSegments,
	findNamedColors,
	isNamedColor,
	type Segment,
} from '../heuristics';
import { toColors } from './stylesheet';

/** The colour an attribute value carries, or null when it carries none. */
function attributeColor(value: string, valueStart: number): ColorMatch | null {
	const format = classifyColorFormat(value);
	if (format === 'unknown') return null;
	if (format === 'named' && !isNamedColor(value)) return null;
	if (format === 'named') return { value, start: valueStart, format };

	const literals = findColorLiterals(value);
	const isSingleLiteral =
		literals.length === 1 && literals[0]?.value.length === value.length;
	if (!isSingleLiteral) return null;
	return { value, start: valueStart, format };
}

/**
 * Shared extractor for HTML and SVG. Colors are only recognized inside:
 * - style="..." attribute values (CSS declarations)
 * - <style>...</style> element contents
 * - the given presentational attributes, when the whole attribute value
 *   is a single color (hex, functional, or named)
 * Bare hex-looking tokens elsewhere (href="#section" fragments, ids)
 * are intentionally not extracted.
 */
/**
 * Every markup dialect's color attributes — SVG's, XML's and HTML's.
 *
 * Listed rather than guessed: `stop-color` and `flood-color` are easy to
 * forget and carry real brand colors. One list for all three, because a
 * page carries an inline `<svg>`; HTML's old pair, `bgcolor` and
 * `color`, was a subset of this, so nothing it used to find is lost.
 * `bgcolor` earns its place twice over — an XML document is not required
 * to be SVG, and `<chart bgcolor="#f0a">` is the shape that put it here.
 */
export const MARKUP_COLOR_ATTRIBUTES = [
	'fill',
	'stroke',
	'stop-color',
	'flood-color',
	'lighting-color',
	'color',
	'bgcolor',
] as const;

export function extractFromMarkup(
	content: string,
	colorAttributes: readonly string[],
): readonly Color[] {
	const blanked = blankComments(content, 'html');
	const matches: ColorMatch[] = [];

	// style="..." attributes
	const styleAttrRe = /style\s*=\s*("([^"]*)"|'([^']*)')/gi;
	let m = styleAttrRe.exec(blanked);
	while (m !== null) {
		const value = m[2] ?? m[3] ?? '';
		const valueStart = m.index + m[0].length - value.length - 1;
		matches.push(...scanCssSegment(blanked, valueStart, value.length));
		m = styleAttrRe.exec(blanked);
	}

	// <style> ... </style> blocks, found by hand rather than by one pattern:
	// a pattern retries from every `<style` to the end of the document, the
	// square of its length when none is closed. A tag with no `>` after it, or
	// a block with no `</style>`, means no later one has either.
	const styleOpenRe = /<style/gi;
	const styleCloseRe = /<\/style>/gi;
	let open = styleOpenRe.exec(blanked);
	while (open !== null) {
		const tagEnd = blanked.indexOf('>', open.index + open[0].length);
		if (tagEnd < 0) break;
		styleCloseRe.lastIndex = tagEnd + 1;
		const close = styleCloseRe.exec(blanked);
		if (close === null) break;
		matches.push(
			...scanCssSegment(blanked, tagEnd + 1, close.index - tagEnd - 1),
		);
		styleOpenRe.lastIndex = close.index + close[0].length;
		open = styleOpenRe.exec(blanked);
	}

	// presentational color attributes: whole value must be one color
	if (colorAttributes.length > 0) {
		const attrRe = new RegExp(
			`(?:^|[\\s<])(?:${colorAttributes.join('|')})\\s*=\\s*("([^"]*)"|'([^']*)')`,
			'gi',
		);
		m = attrRe.exec(blanked);
		while (m !== null) {
			const value = (m[2] ?? m[3] ?? '').trim();
			const valueStart =
				m.index + m[0].length - (m[2] ?? m[3] ?? '').length - 1;
			// Guards in sequence rather than nested: the attribute has a value, it
			// classifies as a colour, and it is either a named colour or the whole
			// value is one literal.
			const attrMatch = value ? attributeColor(value, valueStart) : null;
			if (attrMatch) matches.push(attrMatch);
			m = attrRe.exec(blanked);
		}
	}

	// Text between two tags, when the whole of it is a color. An Android
	// `res/values/colors.xml` is `<color name="brand">#1a2b3c</color>` —
	// the color is the element's content, not an attribute — so a
	// document whose entire purpose is colors reported none. The guard is
	// `attributeColor`'s, unchanged: the trimmed text must be the color
	// entirely, so prose that merely mentions one is not a finding.
	// By hand, as the style blocks are and for their reason: a `>` with no `<`
	// after it means no later `>` has one either.
	let gt = blanked.indexOf('>');
	while (gt >= 0) {
		const lt = blanked.indexOf('<', gt + 1);
		if (lt < 0) break;
		if (lt === gt + 1) {
			gt = blanked.indexOf('>', gt + 1);
			continue;
		}
		const raw = blanked.slice(gt + 1, lt);
		const trimmed = raw.trim();
		if (trimmed.length > 0) {
			const start = gt + 1 + raw.indexOf(trimmed);
			const found = attributeColor(trimmed, start);
			if (found) matches.push(found);
		}
		gt = blanked.indexOf('>', lt + 1);
	}

	matches.sort((a, b) => a.start - b.start);
	return toColors(content, matches);
}

function scanCssSegment(
	blanked: string,
	start: number,
	length: number,
): ColorMatch[] {
	const slice = blanked.slice(start, start + length);
	const rebase = (matches: readonly ColorMatch[]): ColorMatch[] =>
		matches.map((match) => ({ ...match, start: start + match.start }));

	const segments: readonly Segment[] = findDeclarationValueSegments(slice);
	return [
		...rebase(findColorLiterals(slice)),
		...rebase(findNamedColors(slice, segments)),
	];
}
