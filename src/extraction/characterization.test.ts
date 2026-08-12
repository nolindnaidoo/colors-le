import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractColors } from './extract';

/**
 * Characterization tests: pin the CURRENT extraction output per format,
 * including known bugs (multiline color calls missed by per-line regexes,
 * comment detection blind across lines, named colors supported in some
 * formats and not others, SCSS/LESS/Stylus columns 0-based while CSS is
 * 1-based). Behavior changes must update these snapshots in the same
 * commit, so every output diff is explicit.
 */

const FIXTURES: ReadonlyArray<{ fixture: string; languageId: string }> = [
	{ fixture: 'colors.css', languageId: 'css' },
	{ fixture: 'colors.scss', languageId: 'scss' },
	{ fixture: 'colors.less', languageId: 'less' },
	{ fixture: 'colors.styl', languageId: 'stylus' },
	{ fixture: 'colors.html', languageId: 'html' },
	{ fixture: 'colors.js', languageId: 'javascript' },
	{ fixture: 'colors.js', languageId: 'typescript' },
	{ fixture: 'colors.svg', languageId: 'xml' },
];

describe('extraction characterization', () => {
	for (const { fixture, languageId } of FIXTURES) {
		it(`${fixture} as ${languageId}`, async () => {
			const content = readFileSync(
				join(__dirname, '__fixtures__', fixture),
				'utf8',
			);
			const result = await extractColors(content, languageId);
			expect(result).toMatchSnapshot();
		});
	}

	it('unknown language is read as raw text', async () => {
		const result = await extractColors(
			'accent = "#ff8800"  # python, but hex still found',
			'python',
		);
		expect(result).toMatchSnapshot();
	});

	// The rule that makes reading everything safe: `#250` in prose is an issue
	// reference, `#FFF` is a colour, and a stylesheet is untouched by either.
	it('markdown keeps the hex with a letter in it', async () => {
		const result = await extractColors(
			'Closes #250. The paper is #FFF and the ink is #1a2b3c.\n',
			'markdown',
		);
		expect(result).toMatchSnapshot();
	});

	it('json reads design tokens, short hex included', async () => {
		const result = await extractColors(
			'{\n\t"gray": "#250",\n\t"paper": "white"\n}\n',
			'json',
		);
		expect(result).toMatchSnapshot();
	});

	it('empty content returns validation error', async () => {
		const result = await extractColors('', 'css');
		expect(result.success).toBe(false);
		expect(result.colors).toHaveLength(0);
		expect(result.errors[0]?.type).toBe('validation-error');
	});
});
