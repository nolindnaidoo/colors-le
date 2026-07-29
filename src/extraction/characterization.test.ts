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

	it('unknown language falls back to CSS extraction', async () => {
		const result = await extractColors(
			'accent = "#ff8800"  # python, but hex still found',
			'python',
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
