import { describe, expect, it } from 'vitest';
import {
	blankComments,
	classifyColorFormat,
	findColorLiterals,
	findDeclarationValueSegments,
	findNamedColors,
	findStringLiteralSpans,
	isNamedColor,
} from './heuristics';

describe('findColorLiterals', () => {
	it('finds hex colors of every valid length', () => {
		const values = findColorLiterals('#abc #abcd #aabbcc #aabbccdd').map(
			(m) => m.value,
		);
		expect(values).toEqual(['#abc', '#abcd', '#aabbcc', '#aabbccdd']);
	});

	it('rejects invalid hex lengths outright', () => {
		expect(findColorLiterals('#12345 #ab #aabbccddee')).toEqual([]);
	});

	it('finds functional colors with arity validation', () => {
		const values = findColorLiterals(
			'rgb(1, 2, 3) rgba(1, 2, 3, 0.5) hsl(120, 40%, 30%) hsla(1, 2%, 3%, .9)',
		).map((m) => m.value);
		expect(values).toEqual([
			'rgb(1, 2, 3)',
			'rgba(1, 2, 3, 0.5)',
			'hsl(120, 40%, 30%)',
			'hsla(1, 2%, 3%, .9)',
		]);
	});

	it('rejects malformed functional colors', () => {
		expect(findColorLiterals('rgb(1, 2) rgb() hsl(1, 2, 3)')).toEqual([]);
	});

	it('matches functional calls split across lines', () => {
		const matches = findColorLiterals('rgb(1,\n  2, 3)');
		expect(matches).toHaveLength(1);
		expect(matches[0]?.value).toBe('rgb(1, 2, 3)');
		expect(matches[0]?.start).toBe(0);
	});

	it('reports offsets in document order', () => {
		const matches = findColorLiterals('x rgb(1, 2, 3) y #fff');
		expect(matches.map((m) => m.start)).toEqual([2, 17]);
	});
});

describe('named colors', () => {
	it('recognizes CSS named colors incl. rebeccapurple and transparent', () => {
		expect(isNamedColor('navy')).toBe(true);
		expect(isNamedColor('RebeccaPurple')).toBe(true);
		expect(isNamedColor('transparent')).toBe(true);
		expect(isNamedColor('blurple')).toBe(false);
	});

	it('only matches inside provided segments', () => {
		const content = 'red { color: navy; }';
		const segments = findDeclarationValueSegments(content);
		const values = findNamedColors(content, segments).map((m) => m.value);
		expect(values).toEqual(['navy']);
	});
});

describe('findDeclarationValueSegments', () => {
	it('segments after colons up to ; } or newline', () => {
		const content = 'a: red; b: blue }\nc: lime';
		const segments = findDeclarationValueSegments(content);
		const texts = segments.map((s) => content.slice(s.start, s.end).trim());
		expect(texts).toEqual(['red', 'blue', 'lime']);
	});

	it('supports = delimiters for Stylus', () => {
		const content = 'primary = tomato';
		const segments = findDeclarationValueSegments(content, true);
		const texts = segments.map((s) => content.slice(s.start, s.end).trim());
		expect(texts).toEqual(['tomato']);
	});
});

describe('blankComments', () => {
	it('blanks CSS block comments across lines, preserving offsets', () => {
		const content = 'a /* x\n#fff\n */ b';
		const blanked = blankComments(content, 'css');
		expect(blanked.length).toBe(content.length);
		expect(blanked).not.toContain('#fff');
		expect(blanked.split('\n').length).toBe(3);
	});

	it('does not open comments inside strings', () => {
		const content = "content: 'not /* a comment */';";
		expect(blankComments(content, 'css')).toBe(content);
	});

	it('blanks js line comments but not URLs in strings', () => {
		const content = "const u = 'http://x.test'; // #fff";
		const blanked = blankComments(content, 'js');
		expect(blanked).toContain('http://x.test');
		expect(blanked).not.toContain('#fff');
	});

	it('blanks html comments', () => {
		const blanked = blankComments('<i><!-- #fff --></i>', 'html');
		expect(blanked).not.toContain('#fff');
		expect(blanked).toContain('<i>');
	});
});

describe('findStringLiteralSpans', () => {
	it('finds single, double, and template literal contents', () => {
		const content = 'a("x", \'y\', `z`)';
		const spans = findStringLiteralSpans(content);
		const texts = spans.map((s) => content.slice(s.start, s.end));
		expect(texts).toEqual(['x', 'y', 'z']);
	});

	it('template literals may span lines', () => {
		const content = 'const css = `\ncolor: #fff;\n`;';
		const spans = findStringLiteralSpans(content);
		expect(spans).toHaveLength(1);
		expect(content.slice(spans[0]?.start, spans[0]?.end)).toContain('#fff');
	});

	it('ignores strings inside comments', () => {
		const spans = findStringLiteralSpans("// 'not a string'");
		expect(spans).toEqual([]);
	});
});

describe('classifyColorFormat', () => {
	it('classifies every supported format', () => {
		expect(classifyColorFormat('#fff')).toBe('hex');
		expect(classifyColorFormat('rgb(1, 2, 3)')).toBe('rgb');
		expect(classifyColorFormat('rgba(1, 2, 3, 1)')).toBe('rgba');
		expect(classifyColorFormat('hsl(1, 2%, 3%)')).toBe('hsl');
		expect(classifyColorFormat('hsla(1, 2%, 3%, 1)')).toBe('hsla');
		expect(classifyColorFormat('teal')).toBe('named');
		expect(classifyColorFormat('bogus')).toBe('unknown');
	});
});
