import { parseColor } from './colorConversion';
import { bareValue } from './positions';

/**
 * What a line command found in the document: the colours of a results list,
 * one per line as Extract writes them, or the first line that is not one.
 *
 * Dedupe and Sort used to keep the lines that were a six-digit hex, an
 * `rgb()` or an `hsl()` and write those back over the whole document. A
 * results list carrying a short hex, an `rgba()`, an `hwb()` or a keyword
 * lost those lines, and a stylesheet, which has no bare colour line at all,
 * was replaced with nothing. A document that is not a list of colours is
 * refused untouched, with the line that made it so, and every notation
 * Extract reports is a colour.
 */
export type ColorList =
	| { readonly lines: readonly string[] }
	| { readonly other: { readonly line: number; readonly text: string } };

export function readColorList(text: string): ColorList {
	const lines: string[] = [];
	const all = text.split(/\r?\n/);
	for (let index = 0; index < all.length; index++) {
		// Blank lines are dropped from the output and never counted.
		const line = (all[index] ?? '').trim();
		if (line.length === 0) continue;
		if (parseColor(bareValue(line)) === null) {
			return { other: { line: index + 1, text: line } };
		}
		lines.push(line);
	}
	return Object.freeze({ lines: Object.freeze(lines) });
}
