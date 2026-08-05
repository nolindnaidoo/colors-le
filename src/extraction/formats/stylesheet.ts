import type { Color } from '../../types';
import {
	blankComments,
	type ColorMatch,
	type CommentSyntax,
	findColorLiterals,
	findDeclarationValueSegments,
	findNamedColors,
} from '../heuristics';
import { createPositionIndex, lineTextAt } from '../position';

export interface StylesheetOptions {
	/** '//' line comments are valid (SCSS/LESS/Stylus) */
	readonly lineComments: boolean;
	/** '=' also starts a declaration value (Stylus) */
	readonly equalsDelimiter: boolean;
}

/**
 * Shared extractor for the CSS family. Hex and functional literals are
 * found anywhere outside comments; named colors only inside declaration
 * values. Positions are 1-based line/column of the literal itself.
 */
export function extractFromStylesheet(
	content: string,
	options: StylesheetOptions,
): readonly Color[] {
	const syntax: CommentSyntax = options.lineComments ? 'css-line' : 'css';
	const blanked = blankComments(content, syntax);

	const literals = findColorLiterals(blanked);
	const segments = findDeclarationValueSegments(
		blanked,
		options.equalsDelimiter,
	);
	const named = findNamedColors(blanked, segments);

	return toColors(content, [...literals, ...named]);
}

/**
 * Convert offset matches to Color entries against the ORIGINAL content
 * (blanking preserves offsets), deduped by start offset and sorted in
 * document order.
 */
export function toColors(
	content: string,
	matches: readonly ColorMatch[],
): readonly Color[] {
	const positionAt = createPositionIndex(content);
	const byStart = new Map<number, ColorMatch>();
	for (const match of matches) {
		if (!byStart.has(match.start)) {
			byStart.set(match.start, match);
		}
	}

	return [...byStart.values()]
		.sort((a, b) => a.start - b.start)
		.map((match) =>
			Object.freeze({
				value: match.value,
				format: match.format,
				position: positionAt(match.start),
				context: lineTextAt(content, match.start).trim(),
			}),
		);
}
