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

/**
 * Shared extractor for HTML and SVG. Colors are only recognized inside:
 * - style="..." attribute values (CSS declarations)
 * - <style>...</style> element contents
 * - the given presentational attributes, when the whole attribute value
 *   is a single color (hex, functional, or named)
 * Bare hex-looking tokens elsewhere (href="#section" fragments, ids)
 * are intentionally not extracted.
 */
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

	// <style> ... </style> blocks
	const styleBlockRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
	m = styleBlockRe.exec(blanked);
	while (m !== null) {
		const inner = m[1] ?? '';
		const innerStart = m.index + m[0].indexOf(inner);
		matches.push(...scanCssSegment(blanked, innerStart, inner.length));
		m = styleBlockRe.exec(blanked);
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
			if (value) {
				const format = classifyColorFormat(value);
				if (
					format !== 'unknown' &&
					(format !== 'named' || isNamedColor(value))
				) {
					const literals = findColorLiterals(value);
					const isSingleLiteral =
						literals.length === 1 && literals[0]?.value.length === value.length;
					if (format === 'named' || isSingleLiteral) {
						matches.push({ value, start: valueStart, format });
					}
				}
			}
			m = attrRe.exec(blanked);
		}
	}

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
