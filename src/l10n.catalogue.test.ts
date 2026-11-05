import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The mechanical half of reading a catalogue: a value carries nothing but its
 * own language, no locale label pasted onto the end, and in Japanese the
 * full-width colon the rest of its catalogue uses.
 */
const root = join(__dirname, '..');
const read = (path: string): Record<string, string> =>
	JSON.parse(readFileSync(join(root, path), 'utf8'));
const LOCALES = readdirSync(join(root, 'l10n'))
	.map((f) => /^bundle\.l10n\.(.+)\.json$/.exec(f)?.[1])
	.filter((l): l is string => l !== undefined);

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
