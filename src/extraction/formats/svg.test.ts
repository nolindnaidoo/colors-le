import { describe, expect, test } from 'vitest';
import { extractColors, extractorFor } from '../extract';
import { extractFromSvg } from './svg';

describe('extractFromSvg', () => {
	test('extractFromSvg: presentational attributes', () => {
		const svg = '<rect fill="#1a2b3c" stroke="rgb(1, 2, 3)"/>';

		const result = extractFromSvg(svg);

		expect(result.map((color) => color.value)).toEqual([
			'#1a2b3c',
			'rgb(1, 2, 3)',
		]);
	});

	// bgcolor is on this list because the `xml` language id runs this
	// extractor, and an XML document is not required to be SVG. Without it,
	// `<chart bgcolor="#f0a">` lost its only colour.
	test('extractFromSvg: bgcolor', () => {
		const result = extractFromSvg('<chart bgcolor="#f0a"/>');

		expect(result.map((color) => color.value)).toEqual(['#f0a']);
	});

	// The regression: `xml` ran this extractor here and the HTML one in the
	// Rust CLI, so a `fill` attribute was found on one server and missed on
	// the other — the same shared MCP tool giving two answers.
	test('xml runs this extractor, not the HTML one', async () => {
		expect(extractorFor('xml')).toBe('svg');

		const result = await extractColors(
			'<chart bgcolor="#f0a"><rect fill="#1a2b3c"/></chart>',
			'xml',
		);

		expect(result.colors.map((color) => color.value)).toEqual([
			'#f0a',
			'#1a2b3c',
		]);
	});

	// A fragment identifier looks exactly like a three-digit hex, and the
	// whole-value rule on an allow-listed attribute is what keeps it out.
	test('extractFromSvg: a fragment identifier is not a colour', () => {
		expect(extractFromSvg('<link href="#abc"/>')).toEqual([]);
	});
});
