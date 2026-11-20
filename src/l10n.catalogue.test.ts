import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * L10N-14 and L10N-16, the mechanical halves of the catalogue read.
 *
 * A message that tells the user to run a command names it in quotes, so the
 * quoted name must be the title the palette shows in that language; a user
 * told to run «Извлечь цвета» finds «Извлечение цветов». And a value carries
 * nothing but its own language: no locale label pasted onto the end, and in
 * Japanese the full-width colon that most of its own catalogue already uses.
 */
const root = join(__dirname, '..');
const read = (path: string): Record<string, string> =>
	JSON.parse(readFileSync(join(root, path), 'utf8'));
const LOCALES = readdirSync(join(root, 'l10n'))
	.map((f) => /^bundle\.l10n\.(.+)\.json$/.exec(f)?.[1])
	.filter((l): l is string => l !== undefined);

/** Bundle key → the manifest titles its value quotes. */
const QUOTED: Readonly<Record<string, readonly string[]>> = {
	'Deduplicate Colors reads a list of colors, one per line, as Extract Colors writes it. Line {0} is not a color: {1}':
		['manifest.command.dedupe.title', 'manifest.command.extract.title'],
	'Sort Colors reads a list of colors, one per line, as Extract Colors writes it. Line {0} is not a color: {1}':
		['manifest.command.sort.title', 'manifest.command.extract.title'],
	'Run "Colors-LE: Extract Colors" from the command palette': [
		'manifest.command.extract.title',
	],
	'Run "Colors-LE: Open Settings" from the command palette': [
		'manifest.command.settings.title',
	],
	'They read a list of colors, one per line, as Extract Colors writes it, and leave any other document untouched':
		['manifest.command.extract.title'],
};

describe('a command named in a message is named as the palette names it', () => {
	for (const locale of LOCALES) {
		it(locale, () => {
			const bundle = read(`l10n/bundle.l10n.${locale}.json`);
			const nls = read(`src/i18n/package.nls.${locale}.json`);
			const missing: string[] = [];
			for (const [key, titles] of Object.entries(QUOTED)) {
				for (const title of titles) {
					const name = nls[title] ?? '';
					if (!bundle[key]?.toLowerCase().includes(name.toLowerCase()))
						missing.push(
							`${JSON.stringify(name)} not in ${JSON.stringify(bundle[key])}`,
						);
				}
			}
			expect(missing).toEqual([]);
		});
	}
});

describe('every value is in its own language only', () => {
	it('no value carries a language or locale label', () => {
		const labels =
			/简体中文|繁體中文|\(大陆\)|（大陆）|English|Deutsch|Español|Français|日本語|한국어|Русский|Українська|Tiếng Việt|Português/;
		const found: string[] = [];
		for (const locale of LOCALES) {
			for (const [key, value] of Object.entries(
				read(`l10n/bundle.l10n.${locale}.json`),
			)) {
				if (labels.test(value)) found.push(`${locale}: ${key} => ${value}`);
			}
		}
		expect(found).toEqual([]);
	});

	it('Japanese joins its clauses with a full-width colon', () => {
		const ascii = /[぀-ヿ㐀-鿿）] ?: |[぀-ヿ㐀-鿿]:$/;
		const found: string[] = [];
		for (const [key, value] of Object.entries(read('l10n/bundle.l10n.ja.json')))
			if (ascii.test(value.replace(/Colors-LE: /g, '')))
				found.push(`${key} => ${value}`);
		for (const [key, value] of Object.entries(
			read('src/i18n/package.nls.ja.json'),
		))
			if (ascii.test(value)) found.push(`${key} => ${value}`);
		expect(found).toEqual([]);
	});
});
