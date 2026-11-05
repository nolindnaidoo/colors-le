import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A gate is driven with the input it exists to refuse, by the same grep the
 * workflow runs, so a pattern that lets a form through fails here rather
 * than in a review months later.
 */
const workflow = readFileSync(
	join(__dirname, '..', '.github', 'workflows', 'ci-crate.yml'),
	'utf8',
);

function suppressionPattern(): string {
	const pattern = /grep -rnE '([^']*allow[^']*)' crate\/src/.exec(
		workflow,
	)?.[1];
	if (pattern === undefined)
		throw new Error('the inline-suppression step was not found');
	return pattern;
}

function refused(line: string): boolean {
	return (
		spawnSync('grep', ['-E', suppressionPattern()], { input: `${line}\n` })
			.status === 0
	);
}

describe('the inline-suppression gate', () => {
	it.each([
		'#[allow(dead_code)]',
		'#![allow(dead_code)]',
		'#[cfg_attr(test, allow(unused))]',
		'    #[allow(clippy::too_many_lines)]',
	])('refuses %s', (line) => {
		expect(refused(line)).toBe(true);
	});

	it.each([
		'// allow(dead_code) in a comment is prose',
		'#[cfg_attr(not(test), expect(dead_code, reason = "a fixture"))]',
		'let allowed = true;',
	])('lets %s through', (line) => {
		expect(refused(line)).toBe(false);
	});
});
